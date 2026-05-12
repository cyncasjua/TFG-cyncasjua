import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import {
  api,
  getErrorMessage,
  getEventByAccessLink,
  getEventById,
  getSavedRecommendedEvents,
  RecommendedEvent,
} from '../services';
import { formatEventDateRange } from '../utils/sevillaTime';
import { getFullImageUrl } from '../utils/imageUrl';
import type { Event } from '../types/event';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  ThemedText,
  ThemedTextSecondary,
  ThemedTitle,
  ThemedView,
} from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'SavedAndPrivateEvents'>;

const ACCESSED_PRIVATE_LINKS_KEY = 'accessedPrivateLinks';

export const SavedAndPrivateEventsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors, theme } = useTheme();
  const { user } = useAuth();
  const mode = route.params?.mode ?? 'both';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedEvents, setSavedEvents] = useState<RecommendedEvent[]>([]);
  const [privateEvents, setPrivateEvents] = useState<Event[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<Event[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [savedRes, createdRes, rawPrivateLinks, joinedRes] = await Promise.all([
        getSavedRecommendedEvents(),
        user?.id ? api.get(`/events/user/${user.id}`) : Promise.resolve({ data: [] as Event[] }),
        AsyncStorage.getItem(ACCESSED_PRIVATE_LINKS_KEY),
        user?.id
          ? api.get(`/events/attending/${user.id}`)
          : Promise.resolve({ data: [] as Event[] }),
      ]);

      const links: string[] = rawPrivateLinks ? JSON.parse(rawPrivateLinks) : [];
      const privateResults = await Promise.allSettled(
        links.map((link) => getEventByAccessLink(link))
      );

      const linkedPrivate = privateResults
        .filter((item): item is PromiseFulfilledResult<Event> => item.status === 'fulfilled')
        .map((item) => item.value);

      const mergedPrivate = [...(createdRes.data as Event[]), ...linkedPrivate].filter(
        (event, index, arr) => event?.privado && index === arr.findIndex((e) => e.id === event.id)
      );

      const mergedJoined = (joinedRes.data as Event[]).filter(
        (event, index, arr) => event && index === arr.findIndex((e) => e.id === event.id)
      );

      setSavedEvents(savedRes.eventos ?? []);
      setPrivateEvents(mergedPrivate);
      setJoinedEvents(mergedJoined);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const mapSavedToEvent = (event: RecommendedEvent): Event => ({
    id: event.id,
    title: event.title,
    description: event.description,
    address: event.address,
    location: null,
    fechaInicio: event.fechaInicio,
    fechaFin: event.fechaFin,
    precio: null,
    precioMin: null,
    precioMax: null,
    privado: false,
    linkAcceso: undefined,
    categoria: {
      id: 'saved',
      nombre: event.categoria || 'General',
      descripcion: '',
    },
    estado: 'Aprobado',
    creador: {
      id: 'unknown',
      nombre: 'Desconocido',
      email: '',
    },
    imagen: event.imagen || undefined,
    imagenes: [],
  });

  const openEvent = async (event: RecommendedEvent) => {
    const privateMatch = privateEvents.find((privateEvent) => privateEvent.id === event.id);
    if (privateMatch) {
      navigation.navigate('EventDetail', { event: privateMatch });
      return;
    }

    try {
      const fullEvent = await getEventById(event.id);
      navigation.navigate('EventDetail', { event: fullEvent });
    } catch (_err) {
      navigation.navigate('EventDetail', { event: mapSavedToEvent(event) });
    }
  };

  const openPrivateEvent = (event: Event) => {
    navigation.navigate('EventDetail', { event });
  };

  const renderEventCard = (
    key: string,
    imagen: string | undefined,
    title: string,
    address: string,
    fechaInicio: string | undefined | null,
    fechaFin: string | undefined | null,
    categoria: string,
    isOngoing: boolean,
    isWithinWeek: boolean,
    onPress: () => void
  ) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      activeOpacity={0.86}
      style={[
        styles.card,
        {
          backgroundColor: theme === 'dark' ? '#222' : '#fff',
          borderColor: theme === 'dark' ? colors.primary : '#eee',
          shadowColor: theme === 'dark' ? '#000' : '#aaa',
        },
      ]}
    >
      {isOngoing && (
        <ThemedText style={[styles.statusBadge, styles.statusOngoing]}>En curso</ThemedText>
      )}
      {!isOngoing && isWithinWeek && (
        <ThemedText style={[styles.statusBadge, styles.statusSoon]}>En &lt; 7 días</ThemedText>
      )}
      <Image
        source={
          getFullImageUrl(imagen)
            ? { uri: getFullImageUrl(imagen)! }
            : require('../../assets/splash.png')
        }
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.cardBody}>
        <ThemedText style={styles.eventTitle} numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedTextSecondary style={styles.eventInfo}>
          <Icon name="calendar-outline" size={13} />{' '}
          {formatEventDateRange(fechaInicio, fechaFin)}
        </ThemedTextSecondary>
        <ThemedTextSecondary style={styles.eventInfo} numberOfLines={1}>
          <Icon name="map-marker-outline" size={13} /> {address}
        </ThemedTextSecondary>
        <ThemedTextSecondary style={styles.eventInfo}>
          <Icon name="tag-outline" size={13} /> {categoria}
        </ThemedTextSecondary>
      </View>
    </TouchableOpacity>
  );

  const renderPrivateList = (title: string, events: Event[]) => (
    <ThemedView style={{ marginBottom: 16 }}>
      <ThemedTitle style={styles.sectionTitle}>{title}</ThemedTitle>
      {events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="lock-outline" size={44} color={colors.text + '33'} />
          <ThemedTextSecondary style={styles.emptyText}>
            No hay eventos en esta lista.
          </ThemedTextSecondary>
        </View>
      ) : (
        events.map((event) => {
          const nowMs = Date.now();
          const startMs = event.fechaInicio ? new Date(event.fechaInicio).getTime() : NaN;
          const endMs = event.fechaFin ? new Date(event.fechaFin).getTime() : NaN;
          const isOngoing =
            Number.isFinite(startMs) && Number.isFinite(endMs)
              ? nowMs >= startMs && nowMs <= endMs
              : false;
          const isWithinWeek = Number.isFinite(startMs)
            ? startMs > nowMs && startMs - nowMs <= 7 * 24 * 60 * 60 * 1000
            : false;
          return renderEventCard(
            `${title}-${event.id}`,
            event.imagen,
            event.title,
            event.address,
            event.fechaInicio,
            event.fechaFin,
            event.categoria?.nombre || 'General',
            isOngoing,
            isWithinWeek,
            () => openPrivateEvent(event)
          );
        })
      )}
    </ThemedView>
  );

  const renderList = (title: string, events: RecommendedEvent[]) => (
    <ThemedView style={{ marginBottom: 16 }}>
      <ThemedTitle style={styles.sectionTitle}>{title}</ThemedTitle>
      {events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="bookmark-off-outline" size={44} color={colors.text + '33'} />
          <ThemedTextSecondary style={styles.emptyText}>
            No hay eventos en esta lista.
          </ThemedTextSecondary>
        </View>
      ) : (
        events.map((event) => {
          const nowMs = Date.now();
          const startMs = event.fechaInicio ? new Date(event.fechaInicio).getTime() : NaN;
          const endMs = event.fechaFin ? new Date(event.fechaFin).getTime() : NaN;
          const isOngoing =
            Number.isFinite(startMs) && Number.isFinite(endMs)
              ? nowMs >= startMs && nowMs <= endMs
              : false;
          const isWithinWeek = Number.isFinite(startMs)
            ? startMs > nowMs && startMs - nowMs <= 7 * 24 * 60 * 60 * 1000
            : false;
          return renderEventCard(
            `${title}-${event.id}`,
            event.imagen,
            event.title,
            event.address,
            event.fechaInicio,
            event.fechaFin,
            event.categoria || 'General',
            isOngoing,
            isWithinWeek,
            () => openEvent(event)
          );
        })
      )}
    </ThemedView>
  );

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      {!!error && (
        <ThemedText style={{ color: colors.error, marginBottom: 12 }}>{error}</ThemedText>
      )}
      {(mode === 'both' || mode === 'saved') && renderList('Eventos guardados', savedEvents)}
      {(mode === 'both' || mode === 'private') &&
        renderPrivateList('Eventos privados', privateEvents)}
      {mode === 'joined' && renderPrivateList('Eventos a los que estas apuntado', joinedEvents)}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 18, marginBottom: 8 },
  card: {
    borderRadius: 18,
    marginBottom: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 160,
    backgroundColor: '#ccc',
  },
  cardBody: { padding: 14 },
  eventTitle: { fontWeight: 'bold', fontSize: 17, marginBottom: 6 },
  eventInfo: { fontSize: 13, marginBottom: 3 },
  statusBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 'bold',
    zIndex: 10,
  },
  statusOngoing: { backgroundColor: '#4caf50' },
  statusSoon: { backgroundColor: '#ff9800' },
  emptyContainer: { alignItems: 'center', marginTop: 32, gap: 10 },
  emptyText: { textAlign: 'center', fontSize: 14, opacity: 0.6 },
});
