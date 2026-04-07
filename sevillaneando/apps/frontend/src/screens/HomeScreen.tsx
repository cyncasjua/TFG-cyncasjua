
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import {
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  View,
  TextInput,
  Modal,
  Alert,
  Text,
  Linking,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import {
  getEvents,
  api,
  getErrorMessage,
  getEventByAccessLink,
  getEventById,
  getRecommendedEvents,
  getRecommendedRoutes,
  RecommendedEvent,
  RecommendedRoute,
} from '../services/api';
import { RootStackParamList } from '../App';
import type { Event } from '../types/event';
import { useAuth } from '../hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificaciones } from '../context/NotificacionesContext';
import { formatEventDateRange, formatSevillaTime, isEventFinished } from '../utils/sevillaTime';

type EventWithDistance = Event & { distance?: number };
import {
  ThemedView,
  ThemedCard,
  ThemedText,
  ThemedTextSecondary,
  ThemedTitle,
  ThemedButton,
} from '../components';
import { useTheme } from '../hooks/useTheme';
import { ImageBackground } from 'react-native';
import { ProfileHeader } from './ProfileHeader';
import { useSocket } from '../context/SocketContext';
import { reportError, reportWarning } from '../utils/telemetry';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
type RouteStrategy = 'balanced' | 'walkable' | 'score';
type RecommendedRouteWithSource = RecommendedRoute & { sourceStrategy?: RouteStrategy };
type EventTab = 'active' | 'past';

const ACCESSED_PRIVATE_LINKS_KEY = 'accessedPrivateLinks';
const ROUTES_SETTINGS_KEY = 'routesSettingsV1';
const UNIFIED_BORDER_RADIUS = 18;
const RECOMMENDATION_BORDER_RADIUS = 24;
const BOTTOM_DOCK_ICON_SIZE = 36;
const BOTTOM_DOCK_ICON_RADIUS = BOTTOM_DOCK_ICON_SIZE / 2;
const INITIAL_RECOMMENDED_EVENTS_VISIBLE = 8;
const RECOMMENDED_EVENTS_FETCH_LIMIT = 24;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {

  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [items, setItems] = useState<EventWithDistance[]>([]);
  const [recommendedEvents, setRecommendedEvents] = useState<RecommendedEvent[]>([]);
  const [recommendedRoutes, setRecommendedRoutes] = useState<RecommendedRoute[]>([]);
  const [adjustedRoutes, setAdjustedRoutes] = useState<RecommendedRouteWithSource[]>([]);
  const [loadingAdjustedRoutes, setLoadingAdjustedRoutes] = useState(false);
  const [adjustedRoutesError, setAdjustedRoutesError] = useState<string | null>(null);
  const [routesSettingsVisible, setRoutesSettingsVisible] = useState(false);
  const [routeStrategies, setRouteStrategies] = useState<RouteStrategy[]>(['balanced']);
  const [routeCount, setRouteCount] = useState(3);
  const [routeMaxEvents, setRouteMaxEvents] = useState(5);
  const [routeMaxGapMinutes, setRouteMaxGapMinutes] = useState(360);
  const [routeMaxOverlapMinutes, setRouteMaxOverlapMinutes] = useState(15);
  const [showAllRecommendedEvents, setShowAllRecommendedEvents] = useState(false);
  const [showRecommendedEvents, setShowRecommendedEvents] = useState(false);
  const [showRecommendedRoutes, setShowRecommendedRoutes] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [categories, setCategories] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEventTab, setSelectedEventTab] = useState<EventTab>('active');
  const [filterNearby, setFilterNearby] = useState(false);
  const [searchRadius, setSearchRadius] = useState(1);
  const [customRadiusVisible, setCustomRadiusVisible] = useState(false);
  const [customRadiusInput, setCustomRadiusInput] = useState('');
  const [radiusOptions, setRadiusOptions] = useState([0.5, 1, 2, 5, 10]);
  const { role, logout, user } = useAuth();
  const { colors, setTheme, theme } = useTheme();

  const [privateAccessVisible, setPrivateAccessVisible] = useState(false);
  const [privateAccessInput, setPrivateAccessInput] = useState('');

  const [searchText, setSearchText] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFromPicker, setShowDateFromPicker] = useState(false);
  const [showDateToPicker, setShowDateToPicker] = useState(false);


  const { unread } = useNotificaciones();

  const sortWithOtrosLast = useCallback((data: { id: string; nombre: string }[]) => {
    const others = data.filter((item) => item.nombre.trim().toLowerCase() === 'otros');
    const rest = data.filter((item) => item.nombre.trim().toLowerCase() !== 'otros');
    return [...rest, ...others];
  }, []);

  const openPrivateAccess = () => setPrivateAccessVisible(true);
  const closePrivateAccess = () => {
    setPrivateAccessVisible(false);
    setPrivateAccessInput('');
  };

  const handlePrivateAccessSubmit = () => {
    const raw = privateAccessInput.trim();
    if (!raw) {
      Alert.alert('Enlace inválido', 'Introduce un enlace o código de acceso.');
      return;
    }
    const extractAccessCode = (input: string): string => {
      const trimmed = input.trim();

      const regexMatch = trimmed.match(/acceso\/([^/?#]+)/i);
      if (regexMatch?.[1]) return decodeURIComponent(regexMatch[1]);

      if (trimmed.includes('://')) {
        try {
          const parsed = new URL(trimmed);
          const segments = parsed.pathname.split('/').filter(Boolean);
          const candidate = segments[segments.length - 1] || '';
          return decodeURIComponent(candidate);
        } catch (err) {
          void err;
        }
      }

      const clean = trimmed.split(/[?#]/)[0].replace(/\/+$/, '');
      if (!clean.includes('/')) return clean;

      const segments = clean.split('/').filter(Boolean);
      return decodeURIComponent(segments[segments.length - 1] || '');
    };

    const normalized = extractAccessCode(raw);
    if (!normalized) {
      Alert.alert('Enlace inválido', 'No se pudo extraer el código de acceso.');
      return;
    }

    closePrivateAccess();
    navigation.navigate('AccessPrivateEvent', { linkAcceso: normalized });
  };

  const persistCategoryOrder = async (order: string[]) => {
    try {
      await api.patch('/users/me/firebase', { categoryOrder: order });
    } catch (err) {
      reportWarning(
        'home.persist-category-order',
        `Error guardando orden de categorías: ${getErrorMessage(err)}`,
        err,
      );
    }
  };

  const persistRadiusOptions = async (options: number[]) => {
    try {
      await api.patch('/users/me/firebase', { radiusOptions: options });
    } catch (err) {
      reportWarning(
        'home.persist-radius-options',
        `Error guardando radios personalizados: ${getErrorMessage(err)}`,
        err,
      );
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes} min`;
  };

  const calculateWalkingTime = (distanceKm: number): string => {
    // Velocidad promedio a pie: 1.4 m/s = 5.04 km/h
    const minutes = Math.round((distanceKm / 5.04) * 60);
    return formatDuration(minutes);
  };

  const calculateDrivingTime = (distanceKm: number): string => {
    // Velocidad promedio en coche en ciudad: 13.9 m/s = 50 km/h
    const minutes = Math.round((distanceKm / 50) * 60);
    return formatDuration(minutes);
  };

  const handleAddCustomRadius = () => {
    const value = parseFloat(customRadiusInput);
    if (value > 0 && !radiusOptions.includes(value)) {
      const newRadiusOptions = [...radiusOptions, value].sort((a, b) => a - b);
      setRadiusOptions(newRadiusOptions);
      setSearchRadius(value);
      setCustomRadiusInput('');
      setCustomRadiusVisible(false);
      persistRadiusOptions(newRadiusOptions);
    }
  };


  const { socket, isConnected } = useSocket();
  const [unreadMessages, setUnreadMessages] = useState(0);

  const fetchUnreadCount = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('get_conversations');
    } else {
      reportWarning('home.socket', 'Socket no conectado al solicitar conversaciones');
    }
  }, [socket, isConnected]);

  useEffect(() => {
    if (!socket || !isConnected) {
      reportWarning('home.socket', 'Socket o conexión no disponible en HomeScreen');
      return;
    }

    const handleConversations = (data: any[]) => {
      const total = data.reduce((acc: number, conv: any) => {
        return acc + (conv.unreadCount || 0);
      }, 0);
      setUnreadMessages(total);
    };

    socket.on('conversations', handleConversations);

    socket.on('refresh_conversations', fetchUnreadCount);
    socket.on('dm_message', fetchUnreadCount);

    fetchUnreadCount();

    return () => {
      socket.off('conversations', handleConversations);
      socket.off('refresh_conversations', fetchUnreadCount);
      socket.off('dm_message', fetchUnreadCount);
    };
  }, [socket, isConnected, fetchUnreadCount]);


  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/categorias');
        let data = res.data as { id: string; nombre: string }[];
        if (user?.categoryOrder && user.categoryOrder.length > 0) {
          const orderIndex = new Map(user.categoryOrder.map((id, idx) => [id, idx]));
          data = [...data].sort((a, b) => {
            const aIdx = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
            const bIdx = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
            return aIdx - bIdx;
          });
        }
        setCategories(sortWithOtrosLast(data));
      } catch (e) {
        setCategories([]);
      }
    };
    fetchCategories();
  }, [sortWithOtrosLast, user?.categoryOrder]);

  useEffect(() => {
    if (user?.radiusOptions && user.radiusOptions.length > 0) {
      const uniqueSorted = Array.from(new Set(user.radiusOptions))
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((a, b) => a - b);
      if (uniqueSorted.length > 0) {
        setRadiusOptions(uniqueSorted);
        if (!uniqueSorted.includes(searchRadius)) {
          setSearchRadius(uniqueSorted[0]);
        }
      }
    }
  }, [user?.radiusOptions, searchRadius]);

  useEffect(() => {
    const loadRoutesSettings = async () => {
      try {
        const raw = await AsyncStorage.getItem(ROUTES_SETTINGS_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as {
          routeStrategies?: RouteStrategy[];
          routeCount?: number;
          routeMaxEvents?: number;
          routeMaxGapMinutes?: number;
          routeMaxOverlapMinutes?: number;
        };

        if (Array.isArray(parsed.routeStrategies) && parsed.routeStrategies.length > 0) {
          setRouteStrategies(
            parsed.routeStrategies.filter(
              (item): item is RouteStrategy =>
                item === 'balanced' || item === 'walkable' || item === 'score',
            ),
          );
        }
        if (Number.isFinite(parsed.routeCount)) setRouteCount(Math.max(1, Math.min(8, Number(parsed.routeCount))));
        if (Number.isFinite(parsed.routeMaxEvents)) setRouteMaxEvents(Math.max(3, Math.min(8, Number(parsed.routeMaxEvents))));
        if (Number.isFinite(parsed.routeMaxGapMinutes)) setRouteMaxGapMinutes(Math.max(30, Math.min(720, Number(parsed.routeMaxGapMinutes))));
        if (Number.isFinite(parsed.routeMaxOverlapMinutes)) setRouteMaxOverlapMinutes(Math.max(0, Math.min(60, Number(parsed.routeMaxOverlapMinutes))));
      } catch (err) {
        reportWarning('home.load-routes-settings', 'No se pudieron cargar ajustes de rutas', err);
        // Ignore invalid persisted settings.
      }
    };

    loadRoutesSettings();
  }, []);

  useEffect(() => {
    const persistRoutesSettings = async () => {
      try {
        await AsyncStorage.setItem(
          ROUTES_SETTINGS_KEY,
          JSON.stringify({
            routeStrategies,
            routeCount,
            routeMaxEvents,
            routeMaxGapMinutes,
            routeMaxOverlapMinutes,
          }),
        );
      } catch (err) {
        reportWarning('home.persist-routes-settings', 'No se pudieron guardar ajustes de rutas', err);
      }
    };

    persistRoutesSettings();
  }, [routeStrategies, routeCount, routeMaxEvents, routeMaxGapMinutes, routeMaxOverlapMinutes]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const publicEvents = await getEvents(user?.id);

      const raw = await AsyncStorage.getItem(ACCESSED_PRIVATE_LINKS_KEY);
      const links: string[] = raw ? JSON.parse(raw) : [];

      const privateResults = await Promise.allSettled(
        links.map((link) => getEventByAccessLink(link))
      );

      const privateEvents: Event[] = privateResults
        .filter((r): r is PromiseFulfilledResult<Event> => r.status === 'fulfilled')
        .map((r) => r.value);

      const remote: Event[] = [...publicEvents, ...privateEvents].filter(
        (event, index, arr) =>
          index === arr.findIndex((e) => e.id === event.id)
      );

      if (user?.ubicacion?.coordinates && user.ubicacion.coordinates.length === 2) {
        const userLon = user.ubicacion.coordinates[0];
        const userLat = user.ubicacion.coordinates[1];

        const sortedEvents: EventWithDistance[] = remote
          .map((event) => {
            if (!event.location || !event.location.coordinates || event.location.coordinates.length !== 2) {
              return { ...event, distance: Infinity };
            }
            const dist = calculateDistance(
              userLat,
              userLon,
              event.location.coordinates[1],
              event.location.coordinates[0]
            );
            return { ...event, distance: dist };
          })
          .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

        setItems(sortedEvents);
      } else {
        setItems(remote as EventWithDistance[]);
      }
    } catch (err) {
      reportError('home.fetch-events', 'Error cargando eventos', err);
      const message = getErrorMessage(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents])
  );

  const fetchRecommendations = useCallback(async () => {
    setLoadingRecommendations(true);
    setRecommendationsError(null);

    try {
      const lat = user?.ubicacion?.coordinates?.[1];
      const lng = user?.ubicacion?.coordinates?.[0];
      const eventsParams =
        Number.isFinite(lat) && Number.isFinite(lng)
          ? {
              lat: Number(lat),
              lng: Number(lng),
              radiusKm: searchRadius || 12,
              limit: RECOMMENDED_EVENTS_FETCH_LIMIT,
            }
          : { limit: RECOMMENDED_EVENTS_FETCH_LIMIT };

      const routesParams =
        Number.isFinite(lat) && Number.isFinite(lng)
          ? { lat: Number(lat), lng: Number(lng), radiusKm: searchRadius || 12, limit: 8 }
          : { limit: 8 };

      const [eventsResult, routesResult] = await Promise.all([
        getRecommendedEvents(eventsParams),
        getRecommendedRoutes({
          ...routesParams,
          routesLimit: 3,
          strategy: 'balanced',
          minEventsPerRoute: 3,
          maxEventsPerRoute: 5,
          maxGapMinutes: 600,
          maxOverlapMinutes: 30,
        }),
      ]);

      setRecommendedEvents(eventsResult.eventos ?? []);
      setShowAllRecommendedEvents(false);
      setRecommendedRoutes(routesResult.rutas ?? []);
    } catch (err) {
      setRecommendationsError(getErrorMessage(err));
    } finally {
      setLoadingRecommendations(false);
    }
  }, [searchRadius, user?.ubicacion?.coordinates]);

  const fetchAdjustedRoutes = useCallback(async () => {
    if (routeStrategies.length === 0) {
      setAdjustedRoutesError('Selecciona al menos una prioridad.');
      return;
    }

    setLoadingAdjustedRoutes(true);
    setAdjustedRoutesError(null);

    try {
      const lat = user?.ubicacion?.coordinates?.[1];
      const lng = user?.ubicacion?.coordinates?.[0];
      const params =
        Number.isFinite(lat) && Number.isFinite(lng)
          ? { lat: Number(lat), lng: Number(lng), radiusKm: searchRadius || 12 }
          : {};

      const results = await Promise.all(
        routeStrategies.map((strategy) =>
          getRecommendedRoutes({
            ...params,
            strategy,
            routesLimit: routeCount,
            minEventsPerRoute: Math.max(2, routeMaxEvents - 2),
            maxEventsPerRoute: routeMaxEvents,
            maxGapMinutes: routeMaxGapMinutes,
            maxOverlapMinutes: routeMaxOverlapMinutes,
          }),
        ),
      );

      const seen = new Set<string>();
      const merged: RecommendedRouteWithSource[] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const sourceStrategy = routeStrategies[i];
        for (const route of result.rutas ?? []) {
          const signature = `${route.day}|${route.eventos.map((event) => event.id).join('-')}`;
          if (seen.has(signature)) continue;
          seen.add(signature);
          merged.push({ ...route, sourceStrategy });
        }
      }

      const sortedMerged = [...merged].sort((a, b) => {
        const qualityDiff = Number(b.quality ?? 0) - Number(a.quality ?? 0);
        if (qualityDiff !== 0) return qualityDiff;
        return Number(b.scoreMedio) - Number(a.scoreMedio);
      });

      setAdjustedRoutes(sortedMerged.slice(0, routeCount * routeStrategies.length));
      setRoutesSettingsVisible(false);
    } catch (err) {
      setAdjustedRoutesError(getErrorMessage(err));
    } finally {
      setLoadingAdjustedRoutes(false);
    }
  }, [
    routeCount,
    routeMaxEvents,
    routeMaxGapMinutes,
    routeMaxOverlapMinutes,
    routeStrategies,
    searchRadius,
    user?.ubicacion?.coordinates,
  ]);

  useFocusEffect(
    useCallback(() => {
      fetchRecommendations();
    }, [fetchRecommendations])
  );

  const openRecommendedEvent = useCallback(
    async (eventId: string) => {
      try {
        const existing = items.find((event) => event.id === eventId);
        if (existing) {
          navigation.navigate('EventDetail', { event: existing });
          return;
        }

        const event = await getEventById(eventId);
        navigation.navigate('EventDetail', { event });
      } catch (err) {
        Alert.alert('Error', getErrorMessage(err) || 'No se pudo abrir el evento recomendado.');
      }
    },
    [items, navigation],
  );

  const onLogout = async () => {
    try {
      await logout();
    } catch (err) {
      reportError('home.logout', 'Error al cerrar sesión', err);
    }
  };

  const filteredItems = useMemo(() => {
    let filtered = items;

    if (selectedCategory) {
      filtered = filtered.filter((ev) => ev.categoria?.id === selectedCategory);
    }

    if (filterNearby && searchRadius) {
      filtered = filtered.filter(
        (ev) => ev.distance !== undefined && ev.distance <= searchRadius,
      );
    }

    if (searchText.trim() !== '') {
      const text = searchText.trim().toLowerCase();
      filtered = filtered.filter(
        (ev) =>
          ev.title?.toLowerCase().includes(text) || ev.description?.toLowerCase().includes(text),
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      filtered = filtered.filter((ev) => {
        if (!ev.fechaInicio) return false;
        const evDate = new Date(ev.fechaInicio);
        return evDate >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo);
      filtered = filtered.filter((ev) => {
        if (!ev.fechaInicio) return false;
        const evDate = new Date(ev.fechaInicio);
        return evDate <= to;
      });
    }

    const min = minPrice !== '' ? parseFloat(minPrice) : null;
    const max = maxPrice !== '' ? parseFloat(maxPrice) : null;
    if (min !== null) {
      filtered = filtered.filter((ev) => {
        const isGratis =
          (ev.precio == null && ev.precioMin == null && ev.precioMax == null) ||
          ev.precio === 0 ||
          (ev.precioMin === 0 && ev.precioMax === 0);
        if (isGratis) return min === 0 || min === null;
        if (ev.precio != null) return ev.precio >= min;
        if (ev.precioMin != null) return ev.precioMin >= min;
        return true;
      });
    }
    if (max !== null) {
      filtered = filtered.filter((ev) => {
        if (ev.precio != null) return ev.precio <= max;
        if (ev.precioMax != null) return ev.precioMax <= max;
        return true;
      });
    }

    return filtered;
  }, [
    items,
    selectedCategory,
    filterNearby,
    searchRadius,
    searchText,
    dateFrom,
    dateTo,
    minPrice,
    maxPrice,
  ]);

  const activeFilteredItems = useMemo(
    () => filteredItems.filter((item) => !isEventFinished(item.fechaInicio, item.fechaFin)),
    [filteredItems],
  );

  const pastFilteredItems = useMemo(
    () => filteredItems.filter((item) => isEventFinished(item.fechaInicio, item.fechaFin)),
    [filteredItems],
  );

  const visibleItems = useMemo(
    () => (selectedEventTab === 'past' ? pastFilteredItems : activeFilteredItems),
    [activeFilteredItems, pastFilteredItems, selectedEventTab],
  );

  const discoveryTitle = useMemo(() => {
    if (filterNearby) return 'Descubre cerca de ti';
    return 'Descubre algo nuevo';
  }, [filterNearby]);

  const visibleRecommendedEvents = useMemo(
    () =>
      showAllRecommendedEvents
        ? recommendedEvents
        : recommendedEvents.slice(0, INITIAL_RECOMMENDED_EVENTS_VISIBLE),
    [recommendedEvents, showAllRecommendedEvents],
  );

  const hasMoreRecommendedEvents =
    recommendedEvents.length > INITIAL_RECOMMENDED_EVENTS_VISIBLE;

  const homeGreeting = useMemo(() => {
    const hour = dayjs().hour();
    const name = user?.nombre || 'sevillaneante';

    if (hour < 13) return `Buenos dias, ${name}`;
    if (hour < 21) return `Buenas tardes, ${name}`;
    return `Buenas noches, ${name}`;
  }, [user?.nombre]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          accessibilityLabel="Abrir menú"
          style={{ paddingHorizontal: 4, paddingVertical: 2 }}
        >
          <MaterialIcons name="menu" size={26} color={colors.primary} />
        </TouchableOpacity>
      ),
      headerRight: () => null,
    });
  }, [navigation, colors.primary]);

  const handleOpenLink = useCallback(async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Enlace no disponible', 'No se pudo abrir este enlace en tu dispositivo.');
      return;
    }

    await Linking.openURL(url);
  }, []);

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedTextSecondary style={{ marginTop: 8 }}>Cargando eventos...</ThemedTextSecondary>
      </ThemedView>
    );
  }

  return (
    <ImageBackground
      source={require('../../assets/icon.png')}
      style={[styles.background, { backgroundColor: colors.background }]}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
      blurRadius={2}
    >
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor:
              theme === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.25)',
          },
        ]}
      />
      <ThemedView style={styles.container}>
        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ paddingBottom: 190 }}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
        <ThemedView style={styles.header}>
          <View style={styles.headerTopRow}>
            <ThemedText style={styles.heroEyebrow}>{homeGreeting}</ThemedText>
          </View>

          <ThemedTitle style={styles.heroTitle}>{discoveryTitle}</ThemedTitle>
        </ThemedView>

        <ThemedView
          style={[
            styles.recommendationSection,
            { backgroundColor: colors.card + 'D9', borderColor: colors.border },
          ]}
        >
          <ThemedView style={styles.recommendationHeader}>
            <ThemedView style={styles.recommendationHeaderLeft}>
              <View style={[styles.recommendationHeaderIcon, { backgroundColor: colors.primary + '22' }]}>
                <MaterialIcons name="auto-awesome" size={16} color={colors.primary} />
              </View>
              <ThemedTitle style={styles.recommendationTitle}>Para ti</ThemedTitle>
            </ThemedView>
            <View style={styles.recommendationHeaderActions}>
              <TouchableOpacity onPress={fetchRecommendations} style={styles.recommendationRefreshButton}>
                <MaterialIcons name="refresh" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowRecommendedEvents((prev) => !prev)}
                style={styles.recommendationToggleButton}
              >
                <MaterialIcons
                  name={showRecommendedEvents ? 'expand-less' : 'expand-more'}
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          </ThemedView>
          {showRecommendedEvents && (loadingRecommendations ? (
            <ThemedTextSecondary>Cargando recomendaciones...</ThemedTextSecondary>
          ) : recommendationsError ? (
            <ThemedTextSecondary style={{ color: colors.error }}>
              {recommendationsError}
            </ThemedTextSecondary>
          ) : recommendedEvents.length === 0 ? (
            <ThemedTextSecondary>Aun no hay suficientes señales para recomendarte eventos.</ThemedTextSecondary>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recommendedListContent}
              >
                {visibleRecommendedEvents.map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    onPress={() => openRecommendedEvent(event.id)}
                    activeOpacity={0.88}
                    style={[
                      styles.recommendedCard,
                      { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.recommendedCardTop}>
                      <ThemedText style={styles.recommendedCardTitle} numberOfLines={1}>
                        {event.title}
                      </ThemedText>
                      <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
                    </View>
                    <ThemedTextSecondary numberOfLines={1}>{event.categoria || 'General'}</ThemedTextSecondary>
                    {!event.hasMultipleDatesAvailable && (
                      <ThemedTextSecondary numberOfLines={1}>
                        {formatSevillaTime(event.fechaInicio)}
                      </ThemedTextSecondary>
                    )}
                    {event.hasMultipleDatesAvailable && (
                      <ThemedTextSecondary numberOfLines={1}>
                        Varias fechas disponibles
                      </ThemedTextSecondary>
                    )}
                    <ThemedView style={styles.recommendedMetaRow}>
                      <MaterialIcons name="star" size={14} color="#f39c12" />
                      <ThemedTextSecondary>{event.score.toFixed(1)}</ThemedTextSecondary>
                      {event.distanceKm != null && (
                        <>
                          <MaterialIcons name="near-me" size={14} color={colors.primary} style={{ marginLeft: 8 }} />
                          <ThemedTextSecondary>{event.distanceKm.toFixed(1)} km</ThemedTextSecondary>
                        </>
                      )}
                    </ThemedView>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {hasMoreRecommendedEvents && (
                <TouchableOpacity
                  onPress={() => setShowAllRecommendedEvents((prev) => !prev)}
                  style={[styles.recommendedMoreButton, { borderColor: colors.primary + '66' }]}
                  activeOpacity={0.85}
                >
                  <ThemedText style={[styles.recommendedMoreButtonText, { color: colors.primary }]}>
                    {showAllRecommendedEvents ? 'Ver menos' : `Ver más (${recommendedEvents.length})`}
                  </ThemedText>
                  <MaterialIcons
                    name={showAllRecommendedEvents ? 'expand-less' : 'expand-more'}
                    size={16}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
            </>
          ))}
        </ThemedView>

        <ThemedView
          style={[
            styles.recommendationSection,
            { backgroundColor: colors.card + 'D9', borderColor: colors.border },
          ]}
        >
          <ThemedView style={styles.recommendationHeader}>
            <ThemedView style={styles.recommendationHeaderLeft}>
              <View style={[styles.recommendationHeaderIcon, { backgroundColor: colors.primary + '22' }]}>
                <MaterialIcons name="route" size={16} color={colors.primary} />
              </View>
              <ThemedTitle style={styles.recommendationTitle}>Rutas recomendadas</ThemedTitle>
            </ThemedView>
            <View style={styles.recommendationHeaderActions}>
              <TouchableOpacity
                onPress={() => setRoutesSettingsVisible(true)}
                style={styles.recommendationRefreshButton}
              >
                <MaterialIcons name="tune" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowRecommendedRoutes((prev) => !prev)}
                style={styles.recommendationToggleButton}
              >
                <MaterialIcons
                  name={showRecommendedRoutes ? 'expand-less' : 'expand-more'}
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          </ThemedView>
          {showRecommendedRoutes && (loadingRecommendations ? (
            <ThemedTextSecondary>Preparando rutas...</ThemedTextSecondary>
          ) : recommendedRoutes.length === 0 ? (
            <ThemedTextSecondary>Todavia no hay rutas optimizadas para tus gustos.</ThemedTextSecondary>
          ) : (
            <ThemedView style={styles.routesList}>
              {recommendedRoutes.map((route, index) => (
                <TouchableOpacity
                  key={`route-${route.day}-${route.eventos[0]?.id ?? 'x'}-${index}`}
                  activeOpacity={0.88}
                  style={[styles.routeCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => navigation.navigate('RoutePreview', { routePlan: route })}
                >
                  <View style={styles.routeCardTop}>
                    <ThemedText style={styles.routeCardTitle}>
                      {route.day === 'Sin fecha'
                        ? '📅 Varias fechas disponibles'
                        : dayjs(route.day).locale('es').format('dddd DD/MM')}
                    </ThemedText>
                    <ThemedTextSecondary>Score {route.scoreMedio.toFixed(1)}</ThemedTextSecondary>
                  </View>
                  <ThemedTextSecondary>
                    {route.eventos.length} eventos · {route.distanceTotalKm.toFixed(1)} km · {formatDuration(route.temporizacionMinutos)}
                  </ThemedTextSecondary>
                  <ThemedTextSecondary numberOfLines={1}>
                    {route.eventos.map((event) => event.title).join(' · ')}
                  </ThemedTextSecondary>
                </TouchableOpacity>
              ))}
            </ThemedView>
          ))}

          {showRecommendedRoutes && (
            <ThemedView style={{ marginTop: 10 }}>
              <ThemedText style={{ fontWeight: '700', marginBottom: 6 }}>
                Según tus ajustes
              </ThemedText>

              {loadingAdjustedRoutes ? (
                <ThemedTextSecondary>Generando rutas personalizadas...</ThemedTextSecondary>
              ) : adjustedRoutesError ? (
                <ThemedTextSecondary style={{ color: colors.error }}>
                  {adjustedRoutesError}
                </ThemedTextSecondary>
              ) : adjustedRoutes.length === 0 ? (
                <ThemedTextSecondary>
                  Pulsa en ajustes para generar rutas alternativas.
                </ThemedTextSecondary>
              ) : (
                <ThemedView style={styles.routesList}>
                  {adjustedRoutes.map((route, index) => (
                    <TouchableOpacity
                      key={`adjusted-${route.day}-${route.eventos[0]?.id ?? 'x'}-${index}`}
                      activeOpacity={0.88}
                      style={[styles.routeCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                      onPress={() => navigation.navigate('RoutePreview', { routePlan: route })}
                    >
                      <View style={styles.routeCardTop}>
                        <ThemedText style={styles.routeCardTitle}>
                          {route.day === 'Sin fecha'
                            ? '📅 Varias fechas disponibles'
                            : dayjs(route.day).locale('es').format('dddd DD/MM')}
                        </ThemedText>
                        <ThemedTextSecondary>Score {route.scoreMedio.toFixed(1)}</ThemedTextSecondary>
                      </View>
                      <View style={styles.routeMetaRow}>
                        <ThemedTextSecondary>
                          Calidad {Number(route.quality ?? 0).toFixed(0)}%
                        </ThemedTextSecondary>
                        <ThemedTextSecondary>
                          {route.sourceStrategy === 'walkable'
                            ? 'Caminable'
                            : route.sourceStrategy === 'score'
                              ? 'Top score'
                              : 'Equilibrada'}
                        </ThemedTextSecondary>
                      </View>
                      <ThemedTextSecondary>
                        {route.eventos.length} eventos · {route.distanceTotalKm.toFixed(1)} km · {formatDuration(route.temporizacionMinutos)}
                      </ThemedTextSecondary>
                      <ThemedTextSecondary numberOfLines={1}>
                        {route.eventos.map((event) => event.title).join(' · ')}
                      </ThemedTextSecondary>
                    </TouchableOpacity>
                  ))}
                </ThemedView>
              )}
            </ThemedView>
          )}
        </ThemedView>

        {filterNearby && user?.ubicacion && (
          <ThemedView style={{ marginBottom: 12 }}>
            <ThemedText
              style={{
                fontWeight: 'bold',
                fontSize: 13,
                marginLeft: 1,
                marginBottom: 6,
                color: colors.primary,
              }}
            >
              Mostrar hasta:
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 12 }}
            >
              {radiusOptions.map((radius) => (
                <TouchableOpacity
                  key={radius}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: UNIFIED_BORDER_RADIUS,
                    backgroundColor: searchRadius === radius ? '#ffd700' : colors.card,
                    marginRight: 6,
                    borderWidth: 1,
                    borderColor: searchRadius === radius ? '#ffd700' : colors.text + '33',
                  }}
                  onPress={() => setSearchRadius(radius)}
                >
                  <ThemedText
                    style={{
                      color: searchRadius === radius ? '#fff' : colors.text,
                      fontWeight: '500',
                      fontSize: 11,
                    }}
                  >
                    {radius === 0.5 ? '<= 500 m' : `<= ${radius} km`}
                  </ThemedText>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: UNIFIED_BORDER_RADIUS,
                  backgroundColor: colors.card,
                  marginRight: 6,
                  borderWidth: 1,
                  borderColor: colors.primary + '66',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={() => setCustomRadiusVisible(true)}
              >
                <MaterialIcons name="add" size={16} color={colors.primary} />
              </TouchableOpacity>
            </ScrollView>
          </ThemedView>
        )}

        <ThemedView style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <ThemedText
              style={{
                fontWeight: 'bold',
                fontSize: 14,
                marginLeft: 1,
                marginBottom: 8,
                color: colors.primary,
              }}
            >
              Categoría:
            </ThemedText>
            <View style={styles.heroActionsRow}>
              {user?.ubicacion && (
                <TouchableOpacity
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 14,
                    borderRadius: UNIFIED_BORDER_RADIUS,
                    backgroundColor: filterNearby ? '#ffd700' : colors.card,
                    borderWidth: 1.5,
                    borderColor: '#ffd700',
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                  onPress={() => setFilterNearby(!filterNearby)}
                >
                  <MaterialIcons
                    name="near-me"
                    size={15}
                    color={filterNearby ? '#fff' : '#ffd700'}
                    style={{ marginRight: 4 }}
                  />
                  <ThemedText
                    style={{
                      color: filterNearby ? '#fff' : colors.text + '99',
                      fontWeight: '500',
                      fontSize: 11,
                    }}
                  >
                    Cerca
                  </ThemedText>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 10,
                  borderRadius: UNIFIED_BORDER_RADIUS,
                  backgroundColor: colors.card,
                  borderWidth: 1.5,
                  borderColor: colors.primary,
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
                onPress={() => setSearchModalVisible(true)}
                accessibilityLabel="Buscar y filtrar"
              >
                <MaterialIcons name="search" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </ThemedView>

        <ThemedView style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <TouchableOpacity
              style={{
                paddingVertical: 7,
                paddingHorizontal: 14,
                borderRadius: UNIFIED_BORDER_RADIUS,
                backgroundColor: selectedEventTab === 'active' ? colors.primary : colors.card,
                borderWidth: 1.5,
                borderColor: colors.primary,
              }}
              onPress={() => setSelectedEventTab('active')}
            >
              <ThemedText
                style={{
                  color: selectedEventTab === 'active' ? '#fff' : colors.primary,
                  fontWeight: 'bold',
                  fontSize: 13,
                }}
              >
                Activos
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                paddingVertical: 7,
                paddingHorizontal: 14,
                borderRadius: UNIFIED_BORDER_RADIUS,
                backgroundColor: selectedEventTab === 'past' ? colors.primary : colors.card,
                borderWidth: 1.5,
                borderColor: colors.primary,
              }}
              onPress={() => setSelectedEventTab('past')}
            >
              <ThemedText
                style={{
                  color: selectedEventTab === 'past' ? '#fff' : colors.primary,
                  fontWeight: 'bold',
                  fontSize: 13,
                }}
              >
                Finalizados
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>

        {categories.length > 0 && (
          <ThemedView style={{ marginBottom: 12 }}>
            <DraggableFlatList
              horizontal
              data={categories}
              keyExtractor={(item) => item.id}
              onDragEnd={({ data }) => {
                const sortedData = sortWithOtrosLast(data);
                setCategories(sortedData);
                persistCategoryOrder(sortedData.map((item) => item.id));
              }}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 12 }}
              ListHeaderComponent={
                <TouchableOpacity
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 16,
                    borderRadius: UNIFIED_BORDER_RADIUS,
                    backgroundColor: selectedCategory === null ? colors.primary : colors.card,
                    marginRight: 8,
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                  }}
                  onPress={() => setSelectedCategory(null)}
                >
                  <ThemedText
                    style={{
                      color: selectedCategory === null ? '#fff' : colors.primary,
                      fontWeight: 'bold',
                      fontSize: 13,
                    }}
                  >
                    Todas
                  </ThemedText>
                </TouchableOpacity>
              }
              renderItem={({ item, drag, isActive }) => (
                <TouchableOpacity
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 16,
                    borderRadius: UNIFIED_BORDER_RADIUS,
                    backgroundColor: selectedCategory === item.id ? colors.primary : colors.card,
                    marginRight: 8,
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                    opacity: isActive ? 0.7 : 1,
                  }}
                  onPress={() => setSelectedCategory(item.id)}
                  onLongPress={drag}
                  delayLongPress={150}
                >
                  <ThemedText
                    style={{
                      color: selectedCategory === item.id ? '#fff' : colors.primary,
                      fontWeight: 'bold',
                      fontSize: 13,
                    }}
                  >
                    {item.nombre}
                  </ThemedText>
                </TouchableOpacity>
              )}
            />
          </ThemedView>
        )}
        {!user?.ubicacion && (
          <TouchableOpacity
            onPress={() => navigation.navigate('EditProfile')}
            style={{
              backgroundColor: colors.primary + '20',
              borderLeftWidth: 3,
              borderLeftColor: colors.primary,
              padding: 12,
              marginBottom: 12,
              borderRadius: UNIFIED_BORDER_RADIUS,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <MaterialIcons
              name="location-on"
              size={20}
              color={colors.primary}
              style={{ marginRight: 8 }}
            />
            <ThemedText style={{ flex: 1, fontSize: 13, color: colors.primary }}>
              Configura tu ubicación para ver eventos ordenados por cercanía
            </ThemedText>
            <MaterialIcons name="arrow-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}

        {error && <ThemedText style={{ color: colors.error, marginBottom: 8 }}>{error}</ThemedText>}

        {visibleItems.map((item) => {
          const nowMs = Date.now();
          const startMs = item.fechaInicio ? new Date(item.fechaInicio).getTime() : NaN;
          const endMs = item.fechaFin ? new Date(item.fechaFin).getTime() : NaN;
          const isOngoing = Number.isFinite(startMs) && Number.isFinite(endMs)
            ? nowMs >= startMs && nowMs <= endMs
            : false;
          const isWithinWeek = Number.isFinite(startMs)
            ? startMs > nowMs && startMs - nowMs <= 7 * 24 * 60 * 60 * 1000
            : false;
          return (
            <TouchableOpacity key={item.id} onPress={() => navigation.navigate('EventDetail', { event: item })}>
              <ThemedCard style={{ marginBottom: 8, padding: 0, overflow: 'hidden' }}>
                {isOngoing && (
                  <ThemedText style={[styles.statusBadge, styles.statusOngoing]}>
                    En curso
                  </ThemedText>
                )}
                {!isOngoing && isWithinWeek && (
                  <ThemedText style={[styles.statusBadge, styles.statusSoon]}>
                    En &lt; 7 días
                  </ThemedText>
                )}
                {item.distance !== undefined && item.distance !== Infinity && (
                  <ThemedText
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: colors.primary,
                      color: '#fff',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: UNIFIED_BORDER_RADIUS,
                      fontSize: 12,
                      fontWeight: 'bold',
                      zIndex: 10,
                    }}
                  >
                    {item.distance.toFixed(1)} km
                  </ThemedText>
                )}
                <ImageBackground
                  source={item.imagen ? { uri: item.imagen } : require('../../assets/splash.png')}
                  style={{ height: 120, justifyContent: 'flex-end' }}
                  imageStyle={{ opacity: 0.2 }}
                  resizeMode="cover"
                >
                  <ThemedText
                    style={{
                      fontSize: 18,
                      fontWeight: 'bold',
                      color: theme === 'dark' ? '#fff' : '#222',
                      marginBottom: 7,
                      marginLeft: 14,
                      textShadowColor:
                        theme === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.2)',
                      textShadowOffset: { width: 0, height: 2 },
                      textShadowRadius: 6,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.title}
                  </ThemedText>
                  <ThemedTextSecondary
                    style={{
                      fontSize: 13,
                      color: theme === 'dark' ? '#eee' : '#444',
                      marginLeft: 14,
                      marginBottom: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      textShadowColor:
                        theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.1)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 2,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    <MaterialIcons name="place" size={16} color="#ffd700" /> {item.address}
                  </ThemedTextSecondary>
                </ImageBackground>
                <ThemedView style={{ padding: 12 }}>
                  <ThemedView
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
                  >
                    <MaterialIcons name="event" size={16} color="#6c2eb7" />
                    <ThemedTextSecondary style={{ marginLeft: 4 }}>
                      {item.hasMultipleDatesAvailable
                        ? 'Varias fechas disponibles'
                        : formatEventDateRange(item.fechaInicio, item.fechaFin)}
                    </ThemedTextSecondary>
                  </ThemedView>
                  <ThemedView
                    style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
                  >
                    <MaterialIcons name="category" size={16} color="#6c2eb7" />
                    <ThemedTextSecondary style={{ marginLeft: 4 }}>
                      {item.categoria?.nombre}
                    </ThemedTextSecondary>
                  </ThemedView>
                  {item.distance !== undefined && item.distance !== Infinity && (
                    <>
                      <ThemedView
                        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
                      >
                        <MaterialIcons name="directions-walk" size={16} color="#4caf50" />
                        <ThemedTextSecondary style={{ marginLeft: 4 }}>
                          {calculateWalkingTime(item.distance)} a pie
                        </ThemedTextSecondary>
                      </ThemedView>
                      <ThemedView
                        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
                      >
                        <MaterialIcons name="directions-car" size={16} color="#2196F3" />
                        <ThemedTextSecondary style={{ marginLeft: 4 }}>
                          {calculateDrivingTime(item.distance)} en coche
                        </ThemedTextSecondary>
                      </ThemedView>
                    </>
                  )}
                  <ThemedView style={{ alignItems: 'flex-end', marginTop: 8 }}>
                    <ThemedText
                      style={{
                        fontSize: 18,
                        fontWeight: 'bold',
                        color: '#fff',
                        backgroundColor: '#6c2eb7',
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: UNIFIED_BORDER_RADIUS,
                        overflow: 'hidden',
                        alignSelf: 'flex-end',
                      }}
                    >
                      {
                        (() => {
                          if (item.precio != null && item.precio !== 0)
                            return `${item.precio} €`;
                          if (item.precioMin != null && item.precioMax != null)
                            return `${item.precioMin}€ - ${item.precioMax}€`;
                          return 'Gratis';
                        })()
                      }
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              </ThemedCard>
            </TouchableOpacity>
          );
        })}

        <ThemedView
          style={[
            styles.creatorCard,
            {
              backgroundColor: colors.card + 'E6',
              borderColor: colors.primary + '44',
            },
          ]}
        >
          <View style={[styles.creatorBadge, { backgroundColor: colors.primary + '22' }]}>
            <MaterialIcons name="verified" size={16} color={colors.primary} />
            <ThemedText style={[styles.creatorBadgeText, { color: colors.primary }]}>Creado por</ThemedText>
          </View>

          <ThemedText style={styles.creatorName}>Cynthia Castaño Juan</ThemedText>

          <TouchableOpacity
            style={[styles.creatorLinkRow, { borderColor: colors.border }]}
            onPress={() => handleOpenLink('mailto:cynthiacj04@gmail.com')}
            activeOpacity={0.85}
          >
            <MaterialIcons name="email" size={18} color={colors.primary} />
            <ThemedText style={styles.creatorLinkText}>cynthiacj04@gmail.com</ThemedText>
            <MaterialIcons name="open-in-new" size={16} color={colors.text + '80'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.creatorLinkRow, { borderColor: colors.border }]}
            onPress={() =>
              handleOpenLink('https://www.linkedin.com/in/cynthia-casta%C3%B1o-juan-4b7195387/')
            }
            activeOpacity={0.85}
          >
            <MaterialIcons name="work-outline" size={18} color={colors.primary} />
            <ThemedText style={styles.creatorLinkText}>LinkedIn: cynthia-castaño-juan</ThemedText>
            <MaterialIcons name="open-in-new" size={16} color={colors.text + '80'} />
          </TouchableOpacity>
        </ThemedView>
        </ScrollView>

        <View style={[styles.bottomDock, { backgroundColor: colors.card + 'F2', borderColor: colors.border + 'AA' }]}>
          <TouchableOpacity
            style={styles.bottomDockItem}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel="Notificaciones"
            activeOpacity={0.85}
          >
            <View style={[styles.bottomDockIconWrap, { backgroundColor: colors.background }]}>
              <MaterialIcons name="notifications" size={18} color={colors.primary} />
              {unread > 0 && (
                <View style={styles.bottomDockBadge}>
                  <Text style={styles.bottomDockBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </View>
            <ThemedText style={styles.bottomDockLabel} numberOfLines={1}>Notificaciones</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bottomDockItem}
            onPress={() => navigation.navigate('Messages')}
            accessibilityLabel="Mensajes privados"
            activeOpacity={0.85}
          >
            <View style={[styles.bottomDockIconWrap, { backgroundColor: colors.background }]}>
              <MaterialIcons name="mail" size={18} color={colors.primary} />
              {unreadMessages > 0 && (
                <View style={styles.bottomDockBadge}>
                  <Text style={styles.bottomDockBadgeText}>
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </Text>
                </View>
              )}
            </View>
            <ThemedText style={styles.bottomDockLabel} numberOfLines={1}>Mensajes</ThemedText>
          </TouchableOpacity>

          {role === 'user' ? (
            <TouchableOpacity
              style={styles.bottomDockItem}
              onPress={() => navigation.navigate('CreateEvent')}
              accessibilityLabel="Crear evento"
              activeOpacity={0.85}
            >
              <View style={[styles.bottomDockIconWrap, styles.bottomDockPrimaryIconWrap]}>
                <MaterialIcons name="add" size={20} color="#fff" />
              </View>
              <ThemedText style={styles.bottomDockLabel} numberOfLines={1}>Crear</ThemedText>
            </TouchableOpacity>
          ) : (
            role === 'moderator' && (
              <TouchableOpacity
                style={styles.bottomDockItem}
                onPress={() => navigation.navigate('ModeratorEvents')}
                accessibilityLabel="Aprobar eventos"
                activeOpacity={0.85}
              >
                <View style={[styles.bottomDockIconWrap, styles.bottomDockSuccessIconWrap]}>
                  <MaterialIcons name="check" size={20} color="#fff" />
                </View>
                <ThemedText style={styles.bottomDockLabel} numberOfLines={1}>Moderar</ThemedText>
              </TouchableOpacity>
            )
          )}
        </View>

      <Modal
        visible={searchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSearchModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', alignItems: 'center' }}>
          <ThemedView style={{ width: '90%', backgroundColor: colors.card, borderRadius: UNIFIED_BORDER_RADIUS, padding: 20 }}>
            <ThemedTitle style={{ marginBottom: 12 }}>Buscar y filtrar</ThemedTitle>
            <TextInput
              style={{ backgroundColor: colors.background, color: colors.text, borderRadius: UNIFIED_BORDER_RADIUS, paddingHorizontal: 10, height: 38, borderWidth: 1, borderColor: colors.primary + '33', marginBottom: 12 }}
              placeholder="Buscar por título o descripción"
              placeholderTextColor={colors.text + '66'}
              value={searchText}
              onChangeText={setSearchText}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TextInput
                style={{ flex: 1, backgroundColor: colors.background, color: colors.text, borderRadius: UNIFIED_BORDER_RADIUS, paddingHorizontal: 8, height: 38, borderWidth: 1, borderColor: colors.primary + '33' }}
                placeholder="Min €"
                placeholderTextColor={colors.text + '66'}
                value={minPrice}
                onChangeText={setMinPrice}
                keyboardType="numeric"
              />
              <TextInput
                style={{ flex: 1, backgroundColor: colors.background, color: colors.text, borderRadius: UNIFIED_BORDER_RADIUS, paddingHorizontal: 8, height: 38, borderWidth: 1, borderColor: colors.primary + '33' }}
                placeholder="Max €"
                placeholderTextColor={colors.text + '66'}
                value={maxPrice}
                onChangeText={setMaxPrice}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: colors.background, borderRadius: UNIFIED_BORDER_RADIUS, borderWidth: 1, borderColor: colors.primary + '33', height: 38, justifyContent: 'center', paddingHorizontal: 8 }}
                onPress={() => setShowDateFromPicker(true)}
              >
                <ThemedText style={{ color: dateFrom ? colors.text : colors.text + '66' }}>
                  {dateFrom ? dayjs(dateFrom).format('YYYY-MM-DD') : 'Desde '}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: colors.background, borderRadius: UNIFIED_BORDER_RADIUS, borderWidth: 1, borderColor: colors.primary + '33', height: 38, justifyContent: 'center', paddingHorizontal: 8 }}
                onPress={() => setShowDateToPicker(true)}
              >
                <ThemedText style={{ color: dateTo ? colors.text : colors.text + '66' }}>
                  {dateTo ? dayjs(dateTo).format('YYYY-MM-DD') : 'Hasta'}
                </ThemedText>
              </TouchableOpacity>
            </View>
            <DateTimePickerModal
              isVisible={showDateFromPicker}
              mode="date"
              onConfirm={date => {
                setDateFrom(dayjs(date).format('YYYY-MM-DD'));
                setShowDateFromPicker(false);
              }}
              onCancel={() => setShowDateFromPicker(false)}
              maximumDate={dateTo ? new Date(dateTo) : undefined}
            />
            <DateTimePickerModal
              isVisible={showDateToPicker}
              mode="date"
              onConfirm={date => {
                setDateTo(dayjs(date).format('YYYY-MM-DD'));
                setShowDateToPicker(false);
              }}
              onCancel={() => setShowDateToPicker(false)}
              minimumDate={dateFrom ? new Date(dateFrom) : undefined}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <ThemedButton title="Limpiar" variant="secondary" onPress={() => { setSearchText(''); setMinPrice(''); setMaxPrice(''); setDateFrom(''); setDateTo(''); }} />
              <ThemedButton title="Cerrar" variant="secondary" onPress={() => setSearchModalVisible(false)} />
              <ThemedButton title="Buscar" variant="primary" onPress={() => setSearchModalVisible(false)} />
            </View>
          </ThemedView>
        </View>
      </Modal>

      <Modal
        visible={privateAccessVisible}
        transparent
        animationType="fade"
        onRequestClose={closePrivateAccess}
      >
        <View style={styles.privateModalBackdrop}>
          <ThemedView
            style={[
              styles.privateModalCard,
              {
                backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
                borderColor: colors.primary + '55',
              },
            ]}
          >
            <View style={styles.privateModalHeader}>
              <View style={[styles.privateModalIcon, { backgroundColor: colors.primary }]}>
                <MaterialIcons name="lock-open" size={18} color="#fff" />
              </View>
              <ThemedText style={styles.privateModalTitle}>Acceder a evento privado</ThemedText>
            </View>
            <ThemedTextSecondary style={styles.privateModalHint}>
              Introduce el enlace completo o solo el código final.
            </ThemedTextSecondary>

            <TextInput
              value={privateAccessInput}
              onChangeText={setPrivateAccessInput}
              placeholder="Pega el enlace o código"
              placeholderTextColor={theme === 'dark' ? '#aaa' : '#666'}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.privateModalInput,
                {
                  borderColor: colors.border,
                  color: colors.text,
                  backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
                },
              ]}
            />

            <View style={styles.privateModalActions}>
              <ThemedButton title="Cancelar" onPress={closePrivateAccess} />
              <ThemedButton title="Entrar" onPress={handlePrivateAccessSubmit} />
            </View>
          </ThemedView>
        </View>
      </Modal>

      <Modal
        visible={routesSettingsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRoutesSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ThemedView style={[styles.modalContainer, { backgroundColor: colors.card }]}>
            <ThemedTitle style={styles.modalTitle}>Ajustes de rutas</ThemedTitle>

            <ThemedTextSecondary style={{ marginBottom: 6 }}>
              Prioridad (puedes elegir varias)
            </ThemedTextSecondary>
            <View style={styles.routeStrategyRow}>
              {[
                { key: 'balanced', label: 'Equilibrada' },
                { key: 'walkable', label: 'Caminable' },
                { key: 'score', label: 'Top score' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => {
                    const strategy = option.key as RouteStrategy;
                    setRouteStrategies((prev) =>
                      prev.includes(strategy)
                        ? prev.filter((item) => item !== strategy)
                        : [...prev, strategy],
                    );
                  }}
                  style={[
                    styles.routeStrategyChip,
                    {
                      backgroundColor: routeStrategies.includes(option.key as RouteStrategy)
                        ? colors.primary
                        : colors.background,
                      borderColor: colors.primary,
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: routeStrategies.includes(option.key as RouteStrategy)
                        ? '#fff'
                        : colors.primary,
                    }}
                  >
                    {option.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.routeStepRow}>
              <ThemedTextSecondary>Número de rutas</ThemedTextSecondary>
              <View style={styles.routeStepper}>
                <TouchableOpacity onPress={() => setRouteCount((prev) => Math.max(1, prev - 1))}>
                  <MaterialIcons name="remove-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
                <ThemedText style={styles.routeStepperValue}>{routeCount}</ThemedText>
                <TouchableOpacity onPress={() => setRouteCount((prev) => Math.min(8, prev + 1))}>
                  <MaterialIcons name="add-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.routeStepRow}>
              <ThemedTextSecondary>Eventos máximos por ruta</ThemedTextSecondary>
              <View style={styles.routeStepper}>
                <TouchableOpacity onPress={() => setRouteMaxEvents((prev) => Math.max(3, prev - 1))}>
                  <MaterialIcons name="remove-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
                <ThemedText style={styles.routeStepperValue}>{routeMaxEvents}</ThemedText>
                <TouchableOpacity onPress={() => setRouteMaxEvents((prev) => Math.min(8, prev + 1))}>
                  <MaterialIcons name="add-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.routeStepRow}>
              <ThemedTextSecondary>Hueco máximo entre eventos</ThemedTextSecondary>
              <View style={styles.routeStepper}>
                <TouchableOpacity
                  onPress={() => setRouteMaxGapMinutes((prev) => Math.max(30, prev - 30))}
                >
                  <MaterialIcons name="remove-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
                <ThemedText style={styles.routeStepperValue}>{formatDuration(routeMaxGapMinutes)}</ThemedText>
                <TouchableOpacity
                  onPress={() => setRouteMaxGapMinutes((prev) => Math.min(720, prev + 30))}
                >
                  <MaterialIcons name="add-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.routeStepRow}>
              <ThemedTextSecondary>Solape máximo permitido</ThemedTextSecondary>
              <View style={styles.routeStepper}>
                <TouchableOpacity
                  onPress={() => setRouteMaxOverlapMinutes((prev) => Math.max(0, prev - 5))}
                >
                  <MaterialIcons name="remove-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
                <ThemedText style={styles.routeStepperValue}>{formatDuration(routeMaxOverlapMinutes)}</ThemedText>
                <TouchableOpacity
                  onPress={() => setRouteMaxOverlapMinutes((prev) => Math.min(60, prev + 5))}
                >
                  <MaterialIcons name="add-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtonsContainer}>
              <ThemedButton
                title="Cancelar"
                variant="secondary"
                onPress={() => setRoutesSettingsVisible(false)}
                style={{ flex: 1 }}
              />
              <ThemedButton
                title="Generar"
                variant="primary"
                onPress={fetchAdjustedRoutes}
                style={{ flex: 1 }}
              />
            </View>
          </ThemedView>
        </View>
      </Modal>

        {menuVisible && (
          <ThemedView style={styles.menuOverlay}>
            <ThemedView style={[styles.menuContainer, { backgroundColor: colors.card }]}>
              <TouchableOpacity
                style={styles.menuCloseTopButton}
                onPress={() => setMenuVisible(false)}
                accessibilityLabel="Cerrar menú"
              >
                <MaterialIcons name="close" size={26} color="#6c2eb7" />
              </TouchableOpacity>
              <ScrollView
                style={styles.menuScroll}
                contentContainerStyle={styles.menuScrollContent}
                showsVerticalScrollIndicator
              >
                <ThemedTitle style={styles.menuTitle}>Menú</ThemedTitle>
                <ProfileHeader
                  onPress={() => {
                    setMenuVisible(false);
                    navigation.navigate('EditProfile');
                  }}
                />
                <ThemedView style={styles.menuSection}>
                  <ThemedTextSecondary style={{ marginBottom: 8 }}>Tema:</ThemedTextSecondary>
                  <ThemedView style={styles.themeRow}>
                    <ThemedButton
                      title="Claro"
                      variant={theme === 'light' ? 'primary' : 'secondary'}
                      onPress={() => setTheme('light')}
                      style={styles.menuButtonOption}
                    />
                    <ThemedButton
                      title="Oscuro"
                      variant={theme === 'dark' ? 'primary' : 'secondary'}
                      onPress={() => setTheme('dark')}
                      style={styles.menuButtonOption}
                    />
                  </ThemedView>
                </ThemedView>
                <ThemedView style={styles.menuSection}>
                  <ThemedTextSecondary style={{ marginBottom: 8 }}>Accesos:</ThemedTextSecondary>

                <TouchableOpacity
                  style={[styles.menuActionRow, { borderColor: colors.border }]}
                  onPress={() => {
                    setMenuVisible(false);
                    navigation.navigate('EventsMap');
                  }}
                >
                  <MaterialIcons name="map" size={20} color={colors.primary} />
                  <ThemedText style={styles.menuActionLabel}>Mapa de eventos</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuActionRow, { borderColor: colors.border }]}
                  onPress={() => {
                    setMenuVisible(false);
                    navigation.navigate('SavedAndPrivateEvents', { mode: 'saved' });
                  }}
                >
                  <MaterialIcons name="bookmark" size={20} color={colors.primary} />
                  <ThemedText style={styles.menuActionLabel}>Eventos guardados</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuActionRow, { borderColor: colors.border }]}
                  onPress={() => {
                    setMenuVisible(false);
                    navigation.navigate('SavedAndPrivateEvents', { mode: 'private' });
                  }}
                >
                  <MaterialIcons name="lock" size={20} color={colors.primary} />
                  <ThemedText style={styles.menuActionLabel}>Eventos privados</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuActionRow, { borderColor: colors.border }]}
                  onPress={() => {
                    setMenuVisible(false);
                    navigation.navigate('SavedAndPrivateEvents', { mode: 'joined' });
                  }}
                >
                  <MaterialIcons name="how-to-reg" size={20} color={colors.primary} />
                  <ThemedText style={styles.menuActionLabel}>Eventos apuntados</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuActionRow, { borderColor: colors.border }]}
                  onPress={() => {
                    setMenuVisible(false);
                    openPrivateAccess();
                  }}
                >
                  <MaterialIcons name="vpn-key" size={20} color={colors.primary} />
                  <ThemedText style={styles.menuActionLabel}>Entrar con enlace privado</ThemedText>
                </TouchableOpacity>
                </ThemedView>

                <ThemedView style={styles.menuSection}>
                  <ThemedTextSecondary style={{ marginBottom: 8 }}>Comunicacion:</ThemedTextSecondary>

                <TouchableOpacity
                  style={[styles.menuActionRow, { borderColor: colors.border }]}
                  onPress={() => {
                    setMenuVisible(false);
                    navigation.navigate('Notifications');
                  }}
                >
                  <MaterialIcons name="notifications" size={20} color="#ffd700" />
                  <ThemedText style={styles.menuActionLabel}>Notificaciones</ThemedText>
                  {unread > 0 && (
                    <View style={styles.menuActionBadge}>
                      <Text style={styles.menuActionBadgeText}>{unread}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.menuActionRow, { borderColor: colors.border }]}
                  onPress={() => {
                    setMenuVisible(false);
                    navigation.navigate('Messages');
                  }}
                >
                  <MaterialIcons name="mail" size={20} color={colors.primary} />
                  <ThemedText style={styles.menuActionLabel}>Mensajes privados</ThemedText>
                  {unreadMessages > 0 && (
                    <View style={styles.menuActionBadge}>
                      <Text style={styles.menuActionBadgeText}>{unreadMessages}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                </ThemedView>

                {role === 'user' && (
                  <ThemedView style={styles.menuSection}>
                    <ThemedTextSecondary style={{ marginBottom: 8 }}>Tu actividad:</ThemedTextSecondary>
                  <TouchableOpacity
                    style={[styles.menuActionRow, { borderColor: colors.border }]}
                    onPress={() => {
                      setMenuVisible(false);
                      navigation.navigate('UserEvents');
                    }}
                  >
                    <MaterialIcons name="edit" size={20} color={colors.primary} />
                    <ThemedText style={styles.menuActionLabel}>Mis eventos</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.menuActionRow, { borderColor: colors.border }]}
                    onPress={() => {
                      setMenuVisible(false);
                      navigation.navigate('CalendarEvents');
                    }}
                  >
                    <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
                    <ThemedText style={styles.menuActionLabel}>Calendario</ThemedText>
                  </TouchableOpacity>
                  </ThemedView>
                )}

                {role === 'moderator' && (
                  <ThemedView style={styles.menuSection}>
                    <ThemedTextSecondary style={{ marginBottom: 8 }}>Moderacion:</ThemedTextSecondary>
                  <TouchableOpacity
                    style={[styles.menuActionRow, { borderColor: colors.border }]}
                    onPress={() => {
                      setMenuVisible(false);
                      navigation.navigate('ModeratorEvents');
                    }}
                  >
                    <MaterialIcons name="check-circle" size={20} color="#4caf50" />
                    <ThemedText style={styles.menuActionLabel}>Aprobar eventos</ThemedText>
                  </TouchableOpacity>
                  </ThemedView>
                )}

                {role === 'admin' && (
                  <ThemedView style={styles.menuSection}>
                    <ThemedTextSecondary style={{ marginBottom: 8 }}>Administracion:</ThemedTextSecondary>
                  <TouchableOpacity
                    style={[styles.menuActionRow, { borderColor: colors.border }]}
                    onPress={() => {
                      setMenuVisible(false);
                      navigation.navigate('Admin');
                    }}
                  >
                    <MaterialIcons name="admin-panel-settings" size={20} color={colors.primary} />
                    <ThemedText style={styles.menuActionLabel}>Panel de administracion</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.menuActionRow, { borderColor: colors.border }]}
                    onPress={() => {
                      setMenuVisible(false);
                      navigation.navigate('Categories');
                    }}
                  >
                    <MaterialIcons name="category" size={20} color={colors.primary} />
                    <ThemedText style={styles.menuActionLabel}>Gestionar categorias</ThemedText>
                  </TouchableOpacity>
                  </ThemedView>
                )}

                <ThemedView style={styles.menuSection}>
                  <ThemedTextSecondary style={{ marginBottom: 8 }}>Información:</ThemedTextSecondary>
                  <TouchableOpacity
                    style={[styles.menuActionRow, { borderColor: colors.border }]}
                    onPress={() => {
                      setMenuVisible(false);
                      navigation.navigate('LegalAttributions');
                    }}
                  >
                    <MaterialIcons name="policy" size={20} color={colors.primary} />
                    <ThemedText style={styles.menuActionLabel}>Licencias y atribuciones</ThemedText>
                  </TouchableOpacity>
                </ThemedView>

                <ThemedButton
                  title="Cerrar sesión"
                  variant="danger"
                  onPress={onLogout}
                  style={styles.menuButtonOption}
                />
              </ScrollView>
            </ThemedView>
            <TouchableOpacity
              style={styles.menuBackdropPressArea}
              onPress={() => setMenuVisible(false)}
              accessibilityLabel="Cerrar menú"
            />
          </ThemedView>
        )}

        <Modal
          visible={customRadiusVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setCustomRadiusVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <ThemedView style={[styles.modalContainer, { backgroundColor: colors.card }]}>
              <ThemedTitle style={styles.modalTitle}>Radio personalizado</ThemedTitle>
              <ThemedText style={{ marginBottom: 12, color: colors.text }}>
                Ingresa el radio en kilómetros
              </ThemedText>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.primary,
                  },
                ]}
                placeholder="Ej: 3, 7.5, 15"
                placeholderTextColor={colors.text + '66'}
                value={customRadiusInput}
                onChangeText={setCustomRadiusInput}
                keyboardType="decimal-pad"
              />
              <View style={styles.modalButtonsContainer}>
                <ThemedButton
                  title="Cancelar"
                  variant="secondary"
                  onPress={() => {
                    setCustomRadiusVisible(false);
                    setCustomRadiusInput('');
                  }}
                  style={{ flex: 1 }}
                />
                <ThemedButton
                  title="Añadir"
                  variant="primary"
                  onPress={handleAddCustomRadius}
                  style={{ flex: 1, marginLeft: 8 }}
                />
              </View>
            </ThemedView>
          </View>
        </Modal>
      </ThemedView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  logo: { width: 32, height: 32, marginRight: 8 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  headerTitleText: { fontSize: 22, fontWeight: 'bold' },
  background: { flex: 1 },
  backgroundImage: { opacity: 0.2, transform: [{ scale: 1.5 }, { translateY: 40 }] },
  container: { flex: 1, padding: 20, justifyContent: 'flex-start' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    marginTop: 12,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  headerTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.75,
    marginBottom: 0,
    flexShrink: 1,
    marginRight: 8,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 28,
    marginBottom: 6,
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 0,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'trasparent',
    zIndex: 100,
    flexDirection: 'row',
  },
  menuContainer: {
    width: '80%',
    height: '100%',
    maxWidth: 360,
    padding: 24,
    borderTopRightRadius: 40,
    borderBottomRightRadius: 40,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 2, height: 0 },
    position: 'relative',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  menuBackdropPressArea: {
    flex: 1,
  },
  menuCloseTopButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 3,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: UNIFIED_BORDER_RADIUS,
    padding: 6,
  },
  menuTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 18 },
  menuScroll: {
    width: '100%',
  },
  menuScrollContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  menuSection: { marginBottom: 24 },
  menuButtonOption: {
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  menuActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: UNIFIED_BORDER_RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    width: '100%',
  },
  menuActionLabel: {
    marginLeft: 10,
    fontWeight: '600',
    flex: 1,
  },
  menuActionBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: UNIFIED_BORDER_RADIUS,
    backgroundColor: '#d32f2f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  menuActionBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  topShortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  topShortcutsDock: {
    position: 'absolute',
    top: 22,
    left: 68,
    right: 18,
    zIndex: 10,
  },
  topShortcutChip: {
    borderWidth: 1,
    borderRadius: UNIFIED_BORDER_RADIUS,
    width: '23.5%',
    minHeight: 52,
    paddingVertical: 6,
    paddingHorizontal: 4,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  topShortcutLabel: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '600',
  },
  topShortcutBadge: {
    position: 'absolute',
    top: -6,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: UNIFIED_BORDER_RADIUS,
    backgroundColor: '#d32f2f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  topShortcutBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  bottomDock: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    zIndex: 30,
    elevation: 14,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderRadius: UNIFIED_BORDER_RADIUS,
    paddingVertical: 7,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  bottomDockItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 58,
  },
  bottomDockIconWrap: {
    width: BOTTOM_DOCK_ICON_SIZE,
    height: BOTTOM_DOCK_ICON_SIZE,
    borderRadius: BOTTOM_DOCK_ICON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(108, 46, 183, 0.14)',
  },
  bottomDockPrimaryIconWrap: {
    backgroundColor: '#6c2eb7',
    borderColor: '#6c2eb7',
  },
  bottomDockSuccessIconWrap: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  bottomDockLabel: {
    fontSize: 9,
    fontWeight: '700',
  },
  bottomDockBadge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 15,
    height: 15,
    borderRadius: UNIFIED_BORDER_RADIUS,
    backgroundColor: '#d32f2f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  bottomDockBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
  headerButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  smallButton: { paddingHorizontal: 14, paddingVertical: 8 },
  smallButtonText: { fontSize: 12 },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  tinyButton: { paddingHorizontal: 10, paddingVertical: 6 },
  tinyButtonText: { fontSize: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  separator: { height: 12 },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 32,
    zIndex: 20,
    elevation: 8,
    backgroundColor: 'transparent',
  },
  recommendationSection: {
    borderWidth: 1,
    borderRadius: RECOMMENDATION_BORDER_RADIUS,
    padding: 10,
    marginBottom: 12,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recommendationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recommendationHeaderIcon: {
    width: 28,
    height: 28,
    borderRadius: UNIFIED_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationRefreshButton: {
    width: 30,
    height: 30,
    borderRadius: UNIFIED_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  recommendationHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recommendationToggleButton: {
    width: 30,
    height: 30,
    borderRadius: UNIFIED_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  recommendationTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  recommendedListContent: {
    gap: 8,
    paddingRight: 8,
  },
  recommendedCard: {
    width: 200,
    borderRadius: RECOMMENDATION_BORDER_RADIUS,
    borderWidth: 1,
    padding: 9,
  },
  recommendedCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recommendedCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    flex: 1,
    marginRight: 8,
  },
  recommendedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  recommendedMoreButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recommendedMoreButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  routesList: {
    gap: 8,
  },
  routeCard: {
    borderWidth: 1,
    borderRadius: RECOMMENDATION_BORDER_RADIUS,
    padding: 9,
  },
  routeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  routeCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  routeStrategyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  routeStrategyChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  routeStepRow: {
    marginBottom: 12,
    gap: 6,
  },
  routeStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeStepperValue: {
    minWidth: 22,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    borderRadius: UNIFIED_BORDER_RADIUS,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    marginBottom: 12,
    fontSize: 18,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: UNIFIED_BORDER_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 16,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: UNIFIED_BORDER_RADIUS,
    fontSize: 12,
    fontWeight: 'bold',
    zIndex: 10,
  },
  statusOngoing: {
    backgroundColor: '#4caf50',
  },
  statusSoon: {
    backgroundColor: '#ff9800',
  },
  privateModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'center',
    padding: 20,
  },
  privateModalCard: {
    borderRadius: UNIFIED_BORDER_RADIUS,
    padding: 18,
    borderWidth: 1,
  },
  privateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  privateModalIcon: {
    width: 28,
    height: 28,
    borderRadius: UNIFIED_BORDER_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privateModalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  privateModalHint: {
    marginBottom: 12,
    fontSize: 13,
  },
  privateModalInput: {
    borderWidth: 1,
    borderRadius: UNIFIED_BORDER_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 14,
  },
  privateModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  creatorCard: {
    borderWidth: 1,
    borderRadius: UNIFIED_BORDER_RADIUS,
    padding: 14,
    marginTop: 8,
    marginBottom: 28,
  },
  creatorBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 8,
    gap: 5,
  },
  creatorBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  creatorName: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  creatorLinkRow: {
    borderWidth: 1,
    borderRadius: UNIFIED_BORDER_RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  creatorLinkText: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
    fontSize: 13,
    fontWeight: '600',
  },
});
