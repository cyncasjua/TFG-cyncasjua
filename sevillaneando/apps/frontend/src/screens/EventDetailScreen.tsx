import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { FlatList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import {
  Linking,
  Platform,
  Share,
  StyleSheet,
  ImageBackground,
  View,
  Image,
  Modal,
  Animated,
  Alert,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import {
  Avatar,
  ThemedButton,
  OsmAttribution,
  ThemedText,
  ThemedTextSecondary,
  ThemedTitle,
  ThemedView,
} from '../components';
import type { Event } from '../types/event';
import { useIsFocused } from '@react-navigation/native';
import { TextInput, TouchableOpacity } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import * as ImagePicker from 'expo-image-picker';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
import { PublicUser } from '../types/user';
import { getFullImageUrl, getOptimizedChatImageUrl } from '../utils/imageUrl';
import { formatEventDateRange, formatSevillaTime, isEventFinished } from '../utils/sevillaTime';
import {
  attendEvent,
  getErrorMessage,
  getEventAttendees,
  getEventByAccessLink,
  getEventById,
  getEventReviews,
  getPrivateEventShareLink,
  getMyRecommendedEventRating,
  getMyAttendance,
  rateRecommendedEvent,
  saveRecommendedEvent,
  shareRecommendedEvent,
  unattendEvent,
  unsaveRecommendedEvent,
  visitRecommendedEvent,
  type EventReview,
} from '../services';
import { Dimensions } from 'react-native';
import { useSocket } from '../context/SocketContext';
import { reportError } from '../utils/telemetry';
import { OSM_TILE_URL_TEMPLATE, parseEventPoint } from '../utils/map';

type Props = NativeStackScreenProps<RootStackParamList, 'EventDetail'>;

type ChatMessage = {
  id: string;
  eventId: string;
  contenido: string;
  fechaCreacion: string;
  usuario?: { id?: string; nombre?: string; firebaseUid?: string; fotoPerfil?: string };
  imageUrl?: string | null;
};

export const EventDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  const { event: initialEvent } = route.params;
  const [event, setEvent] = useState<Event>(initialEvent);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const defaultEventImage = require('../../assets/splash.png');
  const { colors, theme } = useTheme();
  const coords = useMemo(() => parseEventPoint(event), [event]);
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<number, boolean>>({});
  const coverImage = useMemo(() => getFullImageUrl(event.imagen), [event.imagen]);
  const detailImages = useMemo<Array<{ uri: string; cache?: 'force-cache' } | number>>(() => {
    if (Array.isArray(event.imagenes) && event.imagenes.length > 0) {
      return event.imagenes
        .filter((image): image is string => typeof image === 'string' && image.trim().length > 0)
        .map((image: string) => getFullImageUrl(image))
        .filter((image): image is string => typeof image === 'string' && image.length > 0)
        .map((image) => ({ uri: image, cache: 'force-cache' }));
    }

    if (coverImage) {
      return [{ uri: coverImage, cache: 'force-cache' }];
    }

    return [defaultEventImage];
  }, [coverImage, event.imagenes, defaultEventImage]);
  const isFocused = useIsFocused();
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatError, setChatError] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [pendingImageLocalUri, setPendingImageLocalUri] = useState<string | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const eventChatScrollRef = useRef<ScrollView>(null);
  const [attendees, setAttendees] = useState<PublicUser[]>([]);
  const [isAttending, setIsAttending] = useState(false);
  const [attendeesError, setAttendeesError] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [hasExistingRating, setHasExistingRating] = useState(false);
  const [reviews, setReviews] = useState<EventReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const visitTrackedRef = useRef(false);
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const lastScaleRef = useRef(1);
  const imageScale = Animated.multiply(baseScale, pinchScale);
  const { socket, sendMessage, isConnected } = useSocket();

  const refreshEventDetails = useCallback(async () => {
    const freshEvent =
      initialEvent.privado && initialEvent.linkAcceso
        ? await getEventByAccessLink(initialEvent.linkAcceso)
        : await getEventById(initialEvent.id);
    setEvent(freshEvent);
  }, [initialEvent.id, initialEvent.linkAcceso, initialEvent.privado]);

  useEffect(() => {
    let mounted = true;

    refreshEventDetails().catch(() => {
      // Si falla, mantenemos el evento inicial para no bloquear la vista.
    });

    return () => {
      mounted = false;
    };
  }, [refreshEventDetails]);

  const onPinchEvent = Animated.event([{ nativeEvent: { scale: pinchScale } }], {
    useNativeDriver: true,
  });

  useEffect(() => {
    let mounted = true;
    if (!token) return;

    Promise.all([getEventAttendees(event.id), getMyAttendance(event.id)])
      .then(([list, me]) => {
        if (!mounted) return;
        setAttendees(list);
        setIsAttending(me.attending);
      })
      .catch((err) => {
        if (!mounted) return;
        setAttendeesError(getErrorMessage(err) || 'No se pudo cargar la lista de asistentes');
      });

    return () => {
      mounted = false;
    };
  }, [event.id, token]);

  const refreshReviews = useCallback(async () => {
    try {
      const eventReviews = await getEventReviews(event.id);
      setReviews(eventReviews);
    } catch {
      setReviews([]);
    }
  }, [event.id]);

  useEffect(() => {
    let mounted = true;
    const loadReviews = async () => {
      try {
        setReviewsLoading(true);
        const eventReviews = await getEventReviews(event.id);
        if (!mounted) return;
        setReviews(eventReviews);
      } catch (err) {
        if (!mounted) return;
        console.warn('Error cargando reseñas:', err);
        setReviews([]);
      } finally {
        if (mounted) setReviewsLoading(false);
      }
    };

    loadReviews();
    return () => {
      mounted = false;
    };
  }, [event.id]);

  useEffect(() => {
    if (!token || visitTrackedRef.current) return;
    visitTrackedRef.current = true;

    visitRecommendedEvent(event.id).catch(() => {
      // Si falla no bloquea la experiencia del usuario.
    });
  }, [event.id, token]);

  useEffect(() => {
    let mounted = true;
    if (!token) return;

    getMyRecommendedEventRating(event.id)
      .then((result) => {
        if (!mounted) return;
        if (result.hasRating && result.puntuacion != null) {
          setRatingValue(result.puntuacion);
          setRatingComment(result.comentario ?? '');
          setHasExistingRating(true);
        } else {
          setRatingValue(5);
          setRatingComment('');
          setHasExistingRating(false);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setHasExistingRating(false);
      });

    return () => {
      mounted = false;
    };
  }, [event.id, token]);

  const handleToggleAttend = async () => {
    if (!token) return;
    if (isPastEvent) {
      setAttendeesError('No puedes apuntarte a un evento finalizado.');
      return;
    }
    setAttendeesError('');
    try {
      if (isAttending) {
        const list = await unattendEvent(event.id);
        setAttendees(list);
        setIsAttending(false);
      } else {
        const list = await attendEvent(event.id);
        setAttendees(list);
        setIsAttending(true);
      }
    } catch (err) {
      setAttendeesError(getErrorMessage(err) || 'No se pudo actualizar tu asistencia');
    }
  };

  const handlePinchStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      lastScaleRef.current *= event.nativeEvent.scale;
      baseScale.setValue(lastScaleRef.current);
      pinchScale.setValue(1);
    }
  };

  const closePreview = () => {
    lastScaleRef.current = 1;
    baseScale.setValue(1);
    pinchScale.setValue(1);
    setPreviewImageUrl(null);
  };

  const scrollEventChatToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      eventChatScrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
      setIsKeyboardVisible(true);
      scrollEventChatToBottom();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollEventChatToBottom]);

  const handleToggleSave = async () => {
    if (!token || isRecommendationLoading) return;
    setIsRecommendationLoading(true);
    try {
      if (isSaved) {
        await unsaveRecommendedEvent(event.id);
        setIsSaved(false);
      } else {
        await saveRecommendedEvent(event.id);
        setIsSaved(true);
      }
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err) || 'No se pudo actualizar el guardado del evento.');
    } finally {
      setIsRecommendationLoading(false);
    }
  };

  const handleShareEvent = async () => {
    const shareBaseUrl = (process.env.EXPO_PUBLIC_SHARE_BASE_URL || '').replace(/\/$/, '');
    const isPrivate = Boolean(event.privado);
    const isPrivateCreator = Boolean(isPrivate && user?.id && event.creador?.id === user.id);

    if (isPrivate && !isPrivateCreator) {
      Alert.alert(
        'Acceso restringido',
        'Solo el creador puede compartir el enlace de este evento privado.'
      );
      return;
    }

    let privateLinkAcceso = event.linkAcceso;
    if (isPrivate) {
      try {
        const response = await getPrivateEventShareLink(event.id);
        privateLinkAcceso = response.linkAcceso;
        if (privateLinkAcceso && privateLinkAcceso !== event.linkAcceso) {
          setEvent((prev) => ({ ...prev, linkAcceso: privateLinkAcceso }));
        }
      } catch (err) {
        Alert.alert(
          'Error',
          getErrorMessage(err) || 'No se pudo obtener el enlace privado para compartir.'
        );
        return;
      }
    }

    const canBuildPrivateLink = Boolean(isPrivate && privateLinkAcceso);
    if (isPrivate && !canBuildPrivateLink) {
      Alert.alert('Error', 'No se pudo generar el enlace de invitacion para el evento privado.');
      return;
    }

    const deepLink = isPrivate
      ? `sevillaneando://acceso/${privateLinkAcceso}`
      : `sevillaneando://evento/${event.id}`;
    const webEventLink = shareBaseUrl ? `${shareBaseUrl}/evento/${event.id}` : '';
    const webPrivateLink =
      shareBaseUrl && canBuildPrivateLink ? `${shareBaseUrl}/acceso/${privateLinkAcceso}` : '';
    const webLink = webPrivateLink || webEventLink;
    const eventLink = webLink || deepLink;
    const startText = formatEventDateRange(event.fechaInicio, event.fechaFin);
    const isScraped = event.creador?.email === 'scraper.bot@sevillaneando.local';
    const priceText = (() => {
      if (event.precioMin != null && event.precioMax != null)
        return `${event.precioMin} - ${event.precioMax} EUR`;
      if (event.precio === 0) return isScraped ? 'Consultar precio' : 'Gratis';
      if (event.precio != null) return `${event.precio} EUR`;
      return 'Precio variable';
    })();

    const shareMessage = [
      isPrivate
        ? `Te invito a un evento privado en Sevillaneando: ${event.title}`
        : `Te recomiendo este plan en Sevillaneando: ${event.title}`,
      '',
      `Cuando: ${startText}`,
      `Dónde: ${event.address}`,
      `Categoría: ${event.categoria?.nombre || 'General'}`,
      `Precio: ${priceText}`,
      '',
      `Acceso directo: ${eventLink}`,
      webLink ? `Abrir en la app: ${deepLink}` : null,
      webLink ? 'Si no tienes la app, usa el enlace web.' : null,
    ]
      .filter((line): line is string => !!line)
      .join('\n');

    try {
      const shareResult = await Share.share({
        title: event.title,
        message: shareMessage,
      });

      const wasShared =
        shareResult.action === Share.sharedAction ||
        (Platform.OS === 'android' && shareResult.action !== Share.dismissedAction);

      if (token && wasShared) {
        await shareRecommendedEvent(event.id);
      }
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err) || 'No se pudo compartir el evento.');
    }
  };

  const handleSubmitRating = async () => {
    if (!token || ratingSubmitting) return;

    const comentario = ratingComment.trim();

    try {
      setRatingSubmitting(true);
      await rateRecommendedEvent(
        event.id,
        comentario.length > 0
          ? { puntuacion: ratingValue, comentario }
          : { puntuacion: ratingValue }
      );
      await Promise.all([refreshEventDetails(), refreshReviews()]);
      setHasExistingRating(true);
      setRatingModalVisible(false);
      Alert.alert('Gracias', 'Tu valoración se ha guardado correctamente.');
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err) || 'No se pudo guardar la valoración.');
    } finally {
      setRatingSubmitting(false);
    }
  };

  useEffect(() => {
    if (isChatOpen) {
      scrollEventChatToBottom();
    }
  }, [messages, isChatOpen, scrollEventChatToBottom]);

  const handleSendEventMessage = () => {
    const trimmedText = input.trim();
    if (!trimmedText && !pendingImageUrl) return;

    sendMessage('chat_message', {
      eventId: event.id,
      text: trimmedText,
      imageUrl: pendingImageUrl ?? undefined,
    });

    setInput('');
    setPendingImageLocalUri(null);
    setPendingImageUrl(null);
    Keyboard.dismiss();
  };

  useEffect(() => {
    if (!socket || !token) return;

    socket.emit('join_room', event.id);

    const onHistory = (history: ChatMessage[]) => setMessages(history);
    const onMessage = (message: ChatMessage) => setMessages((prev) => [...prev, message]);
    const onDelete = (messageId: string) =>
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    const onError = (err: { message: string }) => setChatError(err.message);

    socket.on('chat_history', onHistory);
    socket.on('chat_message', onMessage);
    socket.on('delete_event_message_success', onDelete);
    socket.on('chat_error', onError);

    return () => {
      socket.off('chat_history', onHistory);
      socket.off('chat_message', onMessage);
      socket.off('delete_event_message_success', onDelete);
      socket.off('chat_error', onError);
    };
  }, [socket, event.id, token]);

  const formatDuration = (totalMinutes: number, label: string) => {
    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return `${label}: -`;
    const totalHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;

    if (days > 0) {
      if (minutes === 0 && hours === 0) return `${label}: ${days} d`;
      if (minutes === 0) return `${label}: ${days} d ${hours} h`;
      return `${label}: ${days} d ${hours} h ${minutes} min`;
    }

    if (totalHours === 0) return `${label}: ${minutes} min`;
    if (minutes === 0) return `${label}: ${totalHours} h`;
    return `${label}: ${totalHours} h ${minutes} min`;
  };

  const durationText = useMemo(() => {
    const start = dayjs(event.fechaInicio);
    const end = dayjs(event.fechaFin);
    const totalMinutes = end.diff(start, 'minute');
    return formatDuration(totalMinutes, 'Duración');
  }, [event.fechaInicio, event.fechaFin]);

  const isPastEvent = useMemo(
    () => isEventFinished(event.fechaInicio, event.fechaFin),
    [event.fechaInicio, event.fechaFin]
  );

  const remainingText = useMemo(() => {
    const start = dayjs(event.fechaInicio);
    const end = dayjs(event.fechaFin);
    const now = dayjs();

    if (now.isAfter(end)) return 'Tiempo restante: Evento finalizado';
    if (now.isBefore(start)) {
      const minutesToStart = start.diff(now, 'minute');
      return formatDuration(minutesToStart, 'Tiempo restante');
    }

    const minutesToEnd = end.diff(now, 'minute');
    return formatDuration(minutesToEnd, 'Termina en');
  }, [event.fechaInicio, event.fechaFin]);

  const openExternalNavigation = () => {
    if (!coords) return;
    const scheme = Platform.select({ ios: 'maps://0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${coords.latitude},${coords.longitude}`;
    const label = encodeURIComponent(event.title);
    const url = Platform.select({
      ios: `${scheme}${latLng}(${label})`,
      android: `${scheme}${latLng}(${label})`,
    });
    if (url) Linking.openURL(url);
  };

  const uploadChatImage = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!token) {
      setChatError('Necesitas iniciar sesión para subir imágenes');
      return;
    }
    if (!asset?.uri) return;

    try {
      setChatError('');
      setIsUploadingImage(true);

      const processed = await manipulateAsync(asset.uri, [{ resize: { width: 800 } }], {
        compress: 0.6,
        format: SaveFormat.JPEG,
      }).catch(() => null);

      // Si la manipulación falla, usar la imagen original
      const uploadUri = processed?.uri || asset.uri;

      const name = `chat-${Date.now()}.jpg`;
      const mimeType = 'image/jpeg';

      const formData = new FormData();
      formData.append('file', { uri: uploadUri, name, type: mimeType } as any);

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/chat/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        setChatError('No se pudo subir la imagen');
        setPendingImageLocalUri(null);
        setPendingImageUrl(null);
        return;
      }

      const data = await response.json();
      if (!data?.imageUrl) {
        setChatError('Respuesta de imagen invalida');
        setPendingImageLocalUri(null);
        setPendingImageUrl(null);
        return;
      }

      setPendingImageUrl(data.imageUrl);
    } catch (error) {
      reportError(
        'event-detail.upload-chat-image',
        'Error al subir imagen en chat de evento',
        error
      );
      setChatError('Error al subir la imagen');
      setPendingImageLocalUri(null);
      setPendingImageUrl(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handlePickImage = async () => {
    if (!token) {
      setChatError('Necesitas iniciar sesión para subir imágenes');
      return;
    }

    try {
      setChatError('');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        setChatError('Permiso requerido para acceder a fotos');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      await uploadChatImage(asset);
    } catch (error) {
      reportError(
        'event-detail.pick-image',
        'Error al seleccionar imagen del chat de evento',
        error
      );
      setChatError('Error al seleccionar la imagen');
    }
  };

  const handleTakePhoto = async () => {
    if (!token) {
      setChatError('Necesitas iniciar sesión para subir imágenes');
      return;
    }

    try {
      setChatError('');
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        setChatError('Permiso requerido para usar la camara');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      await uploadChatImage(asset);
    } catch (error) {
      reportError('event-detail.take-photo', 'Error al abrir cámara en chat de evento', error);
      setChatError('Error al abrir la camara');
    }
  };

  const handleDeleteEventMessage = (messageId: string) => {
    Alert.alert('Borrar mensaje', '¿Estás seguro de que quieres borrar este mensaje?', [
      { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
      {
        text: 'Borrar',
        onPress: () => {
          sendMessage('delete_event_message', {
            eventId: event?.id,
            messageId,
          });
        },
        style: 'destructive',
      },
    ]);
  };

  const renderActionButton = ({
    icon,
    title,
    subtitle,
    onPress,
    disabled,
    accent,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress: () => void;
    disabled?: boolean;
    accent?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[
        styles.actionButton,
        {
          backgroundColor: accent ? '#6c2eb7' : colors.card,
          borderColor: accent ? 'transparent' : colors.border,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.actionIconWrap,
          { backgroundColor: accent ? 'rgba(255,255,255,0.2)' : '#6c2eb71A' },
        ]}
      >
        <MaterialIcons name={icon as any} size={18} color={accent ? '#FFFFFF' : '#6c2eb7'} />
      </View>
      <View style={styles.actionTextWrap}>
        <ThemedText style={[styles.actionTitle, { color: accent ? '#FFFFFF' : colors.text }]}>
          {title}
        </ThemedText>
        {!!subtitle && (
          <ThemedTextSecondary
            style={[
              styles.actionSubtitle,
              { color: accent ? 'rgba(255,255,255,0.85)' : colors.text + 'AA' },
            ]}
          >
            {subtitle}
          </ThemedTextSecondary>
        )}
      </View>
    </TouchableOpacity>
  );

  if (!isFocused) return null;

  if (!coords) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}>
        <ThemedText>No hay coordenadas para este evento.</ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <ImageBackground
      source={coverImage ? { uri: coverImage, cache: 'force-cache' } : defaultEventImage}
      style={styles.background}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
      blurRadius={3}
    >
      <View
        pointerEvents="none"
        style={[
          styles.backgroundOverlay,
          {
            backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.45)',
          },
        ]}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent', zIndex: 2 }]}>
        <TouchableOpacity
          onPress={() => setIsChatOpen((prev) => !prev)}
          style={[
            styles.chatToggle,
            { backgroundColor: colors.card + 'EE', borderColor: colors.border },
          ]}
        >
          <MaterialIcons
            name={isChatOpen ? 'close' : 'chat-bubble-outline'}
            size={22}
            color="#6c2eb7"
          />
        </TouchableOpacity>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <FlatList
            data={detailImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, idx) => idx.toString()}
            renderItem={({ item, index }) => (
              <Image
                source={
                  imageLoadErrors[index]
                    ? defaultEventImage
                    : typeof item === 'number'
                    ? item
                    : { uri: item.uri, cache: 'force-cache' }
                }
                style={{
                  width: Dimensions.get('window').width - 40,
                  height: 220,
                  borderRadius: 40,
                  marginRight: 10,
                }}
                resizeMode="cover"
                onError={() =>
                  setImageLoadErrors((prev) => ({
                    ...prev,
                    [index]: true,
                  }))
                }
              />
            )}
            style={{ marginBottom: 16 }}
          />
          <ThemedView
            style={[
              { borderRadius: 40, padding: 16, marginBottom: 12 },
              { backgroundColor: colors.card + 'DD' },
            ]}
          >
            <ThemedTitle
              style={[
                styles.title,
                {
                  color: colors.text,
                  marginBottom: 4,
                },
              ]}
            >
              {event.title}
            </ThemedTitle>
            <ThemedTextSecondary style={[styles.subtitle, { marginBottom: 8 }]}>
              <MaterialIcons name="place" size={16} color="#6c2eb7" /> {event.address}
            </ThemedTextSecondary>
            <ThemedText style={[styles.description, { marginBottom: 8 }]}>
              {(() => {
                const urlMatch = event.description?.match(/Fuente: (https?:\/\/\S+)/);
                if (!urlMatch) return event.description;
                const [full, url] = urlMatch;
                const before = event.description!.replace(full, '').trimEnd();
                return (
                  <>
                    {before}
                    {'\n\n'}
                    <ThemedText style={styles.description}>Fuente: </ThemedText>
                    <ThemedText
                      style={[
                        styles.description,
                        { color: '#6c2eb7', textDecorationLine: 'underline' },
                      ]}
                      onPress={() => Linking.openURL(url)}
                    >
                      {url}
                    </ThemedText>
                  </>
                );
              })()}
            </ThemedText>
            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialIcons name="event" size={16} color="#6c2eb7" />
              <ThemedTextSecondary style={{ marginLeft: 4 }}>
                {event.hasMultipleDatesAvailable
                  ? 'Consultar fechas'
                  : formatEventDateRange(event.fechaInicio, event.fechaFin)}
              </ThemedTextSecondary>
            </ThemedView>
            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialIcons name="schedule" size={16} color="#6c2eb7" />
              <ThemedTextSecondary style={{ marginLeft: 4 }}>{durationText}</ThemedTextSecondary>
            </ThemedView>
            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialIcons name="hourglass-bottom" size={16} color="#6c2eb7" />
              <ThemedTextSecondary style={{ marginLeft: 4 }}>{remainingText}</ThemedTextSecondary>
            </ThemedView>
            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialIcons name="category" size={16} color="#6c2eb7" />
              <ThemedTextSecondary style={{ marginLeft: 4 }}>
                {event.categoria?.nombre}
              </ThemedTextSecondary>
            </ThemedView>
            {!!event.recurrencia && (
              <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <MaterialIcons name="repeat" size={16} color="#6c2eb7" />
                <ThemedTextSecondary style={{ marginLeft: 4 }}>
                  {`Evento recurrente: ${
                    {
                      diario: 'cada día',
                      semanal: 'cada semana',
                      quincenal: 'cada 2 semanas',
                      mensual: 'cada mes',
                    }[event.recurrencia]
                  }${
                    event.recurrenciaFin
                      ? ` hasta el ${dayjs(event.recurrenciaFin).format('DD/MM/YYYY')}`
                      : ''
                  }`}
                </ThemedTextSecondary>
              </ThemedView>
            )}
            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialIcons name="star" size={16} color="#f39c12" />
              <ThemedTextSecondary style={{ marginLeft: 4 }}>
                {event.ratingAverage != null
                  ? `${event.ratingAverage.toFixed(1)} (${event.ratingsCount ?? 0} valoraciones)`
                  : 'Sin valoraciones'}
              </ThemedTextSecondary>
            </ThemedView>
            <ThemedView style={{ alignItems: 'flex-end', marginBottom: 8 }}>
              <ThemedText
                style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: '#fff',
                  backgroundColor: '#6c2eb7',
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                  borderRadius: 999,
                  overflow: 'hidden',
                  alignSelf: 'flex-end',
                }}
              >
                {(() => {
                  const scraped = event.creador?.email === 'scraper.bot@sevillaneando.local';
                  if (event.precioMin != null && event.precioMax != null)
                    return `${event.precioMin}€ - ${event.precioMax}€`;
                  if (event.precio === 0) return scraped ? 'Consultar precio' : 'Gratis';
                  if (event.precio != null) return `${event.precio} €`;
                  return 'Precio variable';
                })()}
              </ThemedText>
            </ThemedView>
          </ThemedView>
          <ThemedView
            style={[
              styles.mapContainer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <MapView
              style={StyleSheet.absoluteFillObject}
              initialRegion={{
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <UrlTile urlTemplate={OSM_TILE_URL_TEMPLATE} maximumZ={19} />
              <Marker coordinate={coords} title={event.title} />
            </MapView>
          </ThemedView>
          <ThemedView style={{ marginBottom: 12 }}>
            <OsmAttribution compact />
          </ThemedView>
          <ThemedView
            style={[
              styles.actionsContainer,
              {
                backgroundColor: colors.card + 'E8',
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.actionsHeader}>
              <ThemedText style={[styles.actionsHeaderTitle, { color: colors.text }]}>
                Acciones del evento
              </ThemedText>
              <ThemedTextSecondary style={styles.actionsHeaderHint}>
                Guarda, comparte y valora para mejorar recomendaciones
              </ThemedTextSecondary>
            </View>
            {renderActionButton({
              icon: isAttending ? 'event-busy' : 'event-available',
              title: isPastEvent
                ? 'Evento finalizado'
                : isAttending
                ? 'Ya no asistiré'
                : 'Asistiré',
              subtitle: isPastEvent
                ? 'No se puede apuntar a eventos pasados'
                : isAttending
                ? 'Eliminar de tu agenda'
                : 'Añadir a tu agenda',
              onPress: handleToggleAttend,
              accent: true,
              disabled: isPastEvent,
            })}
            <View style={styles.actionsRow}>
              {renderActionButton({
                icon: 'groups',
                title: `Asistentes (${attendees.length})`,
                subtitle: 'Ver quiénes van',
                onPress: () => setShowAttendeesModal(true),
              })}
              {renderActionButton({
                icon: 'map',
                title: 'Abrir mapa',
                subtitle: 'Google/Apple Maps',
                onPress: openExternalNavigation,
              })}
            </View>
            <View style={styles.actionsRow}>
              {renderActionButton({
                icon: isSaved ? 'bookmark-remove' : 'bookmark-add',
                title: isSaved ? 'Quitar guardado' : 'Guardar evento',
                subtitle: 'Para recomendaciones',
                onPress: handleToggleSave,
                disabled: isRecommendationLoading,
              })}
              {renderActionButton({
                icon: 'share',
                title: event.privado ? 'Invitar' : 'Compartir',
                subtitle: event.privado
                  ? event.creador?.id === user?.id
                    ? 'Enviar enlace de acceso privado'
                    : 'Solo el creador puede compartir'
                  : 'Enviar a tus contactos',
                onPress: handleShareEvent,
                disabled: Boolean(event.privado && event.creador?.id !== user?.id),
              })}
            </View>
            {renderActionButton({
              icon: 'star-rate',
              title: hasExistingRating ? 'Editar valoración' : 'Valorar evento',
              subtitle: hasExistingRating ? 'Tu opinión guardada' : 'Tu opinión mejora las rutas',
              onPress: () => setRatingModalVisible(true),
            })}
          </ThemedView>
          {!!attendeesError && (
            <ThemedTextSecondary style={{ color: '#c0392b', marginTop: 6 }}>
              {attendeesError}
            </ThemedTextSecondary>
          )}
          <ThemedView style={{ marginTop: 16, marginBottom: 12 }}>
            <ThemedTitle style={{ fontSize: 18, marginBottom: 12 }}>Opiniones</ThemedTitle>
            {reviewsLoading ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginVertical: 8 }}
              />
            ) : reviews.length === 0 ? (
              <ThemedTextSecondary style={{ fontSize: 14, fontStyle: 'italic' }}>
                No hay opiniones aún. ¡Sé el primero en valorar este evento!
              </ThemedTextSecondary>
            ) : (
              <ScrollView scrollEnabled={false} nestedScrollEnabled={false}>
                {reviews.map((review) => {
                  const autor = review.autor;
                  return (
                    <ThemedView
                      key={review.id}
                      style={[
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          borderRadius: 40,
                          padding: 12,
                          marginBottom: 10,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        {autor?.id && (
                          <TouchableOpacity
                            onPress={() => navigation.navigate('UserProfile', { userId: autor.id })}
                            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                          >
                            <Avatar photoUrl={autor.fotoPerfil} size={32} />
                            <View style={{ marginLeft: 10, flex: 1 }}>
                              <ThemedText style={{ fontWeight: '600', fontSize: 13 }}>
                                {autor.nombre}
                              </ThemedText>
                              <ThemedTextSecondary style={{ fontSize: 11 }}>
                                {formatSevillaTime(review.fecha)}
                              </ThemedTextSecondary>
                            </View>
                          </TouchableOpacity>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          {[...Array(5)].map((_, i) => (
                            <MaterialIcons
                              key={i}
                              name={i < review.puntuacion ? 'star' : 'star-border'}
                              size={14}
                              color={i < review.puntuacion ? '#f39c12' : colors.text + '44'}
                            />
                          ))}
                        </View>
                      </View>
                      {review.comentario && (
                        <ThemedText style={{ fontSize: 13, lineHeight: 18 }}>
                          {review.comentario}
                        </ThemedText>
                      )}
                    </ThemedView>
                  );
                })}
              </ScrollView>
            )}
          </ThemedView>
          <Modal
            visible={showAttendeesModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowAttendeesModal(false)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.45)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: '85%',
                  backgroundColor: colors.card,
                  borderRadius: 40,
                  padding: 18,
                  maxHeight: '70%',
                }}
              >
                <ThemedTitle style={{ marginBottom: 12 }}>
                  Asistentes ({attendees.length})
                </ThemedTitle>
                <ScrollView style={{ maxHeight: 350 }}>
                  {attendees.map((att) => (
                    <TouchableOpacity
                      key={att.id}
                      onPress={() => {
                        setShowAttendeesModal(false);
                        navigation.navigate('UserProfile', { userId: att.id });
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        padding: 8,
                        backgroundColor: colors.card,
                        borderRadius: 999,
                        marginBottom: 6,
                      }}
                    >
                      <Avatar photoUrl={att.fotoPerfil} size={32} />
                      <ThemedText>{att.nombre}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <ThemedButton
                  title="Cerrar"
                  variant="secondary"
                  onPress={() => setShowAttendeesModal(false)}
                />
              </View>
            </View>
          </Modal>
          <Modal
            visible={ratingModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setRatingModalVisible(false)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.45)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: '85%',
                  backgroundColor: colors.card,
                  borderRadius: 40,
                  padding: 18,
                }}
              >
                <ThemedTitle style={{ marginBottom: 12 }}>
                  {hasExistingRating ? 'Tu valoración' : 'Valorar evento'}
                </ThemedTitle>
                <ThemedTextSecondary style={{ marginBottom: 10 }}>
                  {hasExistingRating
                    ? 'Puedes editar tu puntuación y comentario cuando quieras.'
                    : 'Tu puntuación ayuda a mejorar recomendaciones y rutas.'}
                </ThemedTextSecondary>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setRatingValue(value)}
                      style={{ padding: 4 }}
                    >
                      <MaterialIcons
                        name={value <= ratingValue ? 'star' : 'star-border'}
                        size={32}
                        color={value <= ratingValue ? '#f39c12' : colors.text + '88'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={ratingComment}
                  onChangeText={setRatingComment}
                  placeholder="Escribe tu opinión (opcional)"
                  multiline
                  style={{
                    minHeight: 90,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 40,
                    padding: 10,
                    color: colors.text,
                    marginBottom: 12,
                  }}
                  placeholderTextColor={colors.text + '99'}
                />
                <ThemedView style={{ flexDirection: 'row', gap: 8 }}>
                  <ThemedButton
                    title="Cancelar"
                    variant="secondary"
                    onPress={() => setRatingModalVisible(false)}
                    style={{ flex: 1 }}
                  />
                  <ThemedButton
                    title={ratingSubmitting ? 'Guardando...' : 'Enviar'}
                    onPress={handleSubmitRating}
                    style={{ flex: 1 }}
                    disabled={ratingSubmitting}
                  />
                </ThemedView>
              </View>
            </View>
          </Modal>
        </ScrollView>
        {isChatOpen && (
          <View style={styles.chatOverlay}>
            <ThemedView style={[styles.chatPanel, { backgroundColor: colors.card }]}>
              <ThemedView style={styles.chatHeader}>
                <ThemedTitle>Chat del evento</ThemedTitle>
              </ThemedView>
              {!!chatError && (
                <ThemedTextSecondary style={{ marginBottom: 6, color: '#c0392b' }}>
                  {chatError}
                </ThemedTextSecondary>
              )}
              <ScrollView
                ref={eventChatScrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 12 }}
                onContentSizeChange={scrollEventChatToBottom}
                onLayout={scrollEventChatToBottom}
              >
                {messages.map((item) => {
                  const hasImage = !!getFullImageUrl(item.imageUrl);
                  const isOwn = item.usuario?.firebaseUid === user?.firebaseUid;
                  const nameColor = isOwn ? 'rgba(255,255,255,0.75)' : colors.primary;
                  const messageColor = isOwn ? '#fff' : colors.text;

                  return (
                    <ThemedView
                      key={item.id}
                      style={{
                        marginBottom: 6,
                        alignItems: isOwn ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <ThemedView
                        style={{
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          gap: 6,
                          maxWidth: '85%',
                        }}
                      >
                        {!isOwn && item.usuario?.id && (
                          <TouchableOpacity
                            onPress={() => {
                              if (item.usuario?.id) {
                                navigation.navigate('UserProfile', {
                                  userId: item.usuario.id,
                                });
                              }
                            }}
                            style={{ marginTop: 2 }}
                          >
                            <Avatar photoUrl={item.usuario?.fotoPerfil} size={24} />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onLongPress={() => isOwn && handleDeleteEventMessage(item.id)}
                          activeOpacity={0.9}
                          style={[
                            styles.chatBubble,
                            hasImage && styles.chatBubbleWithImage,
                            {
                              backgroundColor: isOwn ? '#6c2eb7' : colors.card,
                            },
                          ]}
                        >
                          <TouchableOpacity
                            onPress={() => {
                              if (item.usuario?.id && !isOwn) {
                                navigation.navigate('UserProfile', {
                                  userId: item.usuario.id,
                                });
                              }
                            }}
                            disabled={!item.usuario?.id || isOwn}
                          >
                            <ThemedTextSecondary
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              style={[styles.chatMetaText, { color: nameColor }]}
                            >
                              {isOwn ? 'Tú' : item.usuario?.nombre ?? 'Anónimo'}
                            </ThemedTextSecondary>
                          </TouchableOpacity>
                          {!!item.contenido?.trim() && (
                            <ThemedText style={{ color: messageColor }}>
                              {item.contenido}
                            </ThemedText>
                          )}
                          {!!getFullImageUrl(item.imageUrl) && (
                            <TouchableOpacity
                              onPress={() =>
                                setPreviewImageUrl(getFullImageUrl(item.imageUrl) ?? null)
                              }
                            >
                              <View style={{ position: 'relative' }}>
                                {loadingImages.has(item.id) && (
                                  <View
                                    style={[
                                      styles.chatMessageImage,
                                      {
                                        position: 'absolute',
                                        zIndex: 10,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        backgroundColor: colors.card + '99',
                                      },
                                    ]}
                                  >
                                    <ActivityIndicator size="small" color="#6c2eb7" />
                                  </View>
                                )}
                                <Image
                                  source={{ uri: getOptimizedChatImageUrl(item.imageUrl)! }}
                                  style={styles.chatMessageImage}
                                  resizeMode="cover"
                                  onLoadStart={() =>
                                    setLoadingImages((prev) => new Set(prev).add(item.id))
                                  }
                                  onLoadEnd={() =>
                                    setLoadingImages((prev) => {
                                      const next = new Set(prev);
                                      next.delete(item.id);
                                      return next;
                                    })
                                  }
                                />
                              </View>
                            </TouchableOpacity>
                          )}
                          <ThemedTextSecondary
                            numberOfLines={1}
                            style={[
                              styles.chatTimeText,
                              {
                                color: isOwn ? 'rgba(255,255,255,0.75)' : colors.text + '99',
                              },
                            ]}
                          >
                            {formatSevillaTime(item.fechaCreacion)}
                          </ThemedTextSecondary>
                        </TouchableOpacity>
                        {!isOwn && item.usuario?.id && (
                          <TouchableOpacity
                            onPress={() => {
                              if (item.usuario?.id) {
                                navigation.navigate('DirectMessage', {
                                  userId: item.usuario.id,
                                  userName: item.usuario.nombre ?? 'Usuario',
                                });
                              }
                            }}
                            style={{
                              marginTop: 2,
                              padding: 4,
                              borderRadius: 12,
                              backgroundColor: colors.card,
                            }}
                          >
                            <MaterialIcons name="mail" size={16} color="#6c2eb7" />
                          </TouchableOpacity>
                        )}
                      </ThemedView>
                    </ThemedView>
                  );
                })}
              </ScrollView>
              {!!pendingImageUrl && !isUploadingImage && (
                <ThemedView style={styles.chatAttachment}>
                  <MaterialIcons name="image" size={18} color={colors.text} />
                  <ThemedTextSecondary style={{ marginLeft: 8, color: colors.text + '99' }}>
                    Imagen lista para enviar
                  </ThemedTextSecondary>
                  <TouchableOpacity
                    onPress={() => {
                      setPendingImageLocalUri(null);
                      setPendingImageUrl(null);
                    }}
                    style={styles.chatAttachmentRemove}
                  >
                    <MaterialIcons name="close" size={16} color={colors.text} />
                  </TouchableOpacity>
                </ThemedView>
              )}
              {isUploadingImage && (
                <ThemedView style={[styles.chatAttachment, { opacity: 0.7 }]}>
                  <MaterialIcons name="cloud-upload" size={18} color={colors.text} />
                  <ThemedTextSecondary style={{ marginLeft: 8, color: colors.text + '99' }}>
                    Cargando imagen...
                  </ThemedTextSecondary>
                </ThemedView>
              )}
              <ThemedView
                style={[
                  styles.chatComposer,
                  { marginBottom: isKeyboardVisible ? Math.max(keyboardHeight - 10, 0) : 0 },
                ]}
              >
                <TouchableOpacity
                  onPress={handlePickImage}
                  disabled={isUploadingImage}
                  style={styles.chatImageButton}
                >
                  <MaterialIcons name="image" size={20} color="#6c2eb7" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleTakePhoto}
                  disabled={isUploadingImage}
                  style={styles.chatImageButton}
                >
                  <MaterialIcons name="photo-camera" size={20} color="#6c2eb7" />
                </TouchableOpacity>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Escribe un mensaje..."
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 16,
                    padding: 10,
                    color: colors.text,
                  }}
                  placeholderTextColor={colors.text + '99'}
                />
                <TouchableOpacity
                  onPress={handleSendEventMessage}
                  style={{
                    marginLeft: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: '#6c2eb7',
                    borderRadius: 16,
                  }}
                >
                  <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Enviar</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          </View>
        )}
        <Modal
          visible={!!previewImageUrl}
          transparent
          animationType="fade"
          onRequestClose={closePreview}
        >
          <View style={styles.imagePreviewOverlay}>
            <TouchableOpacity
              style={styles.imagePreviewBackdrop}
              onPress={closePreview}
              activeOpacity={1}
            />
            <TouchableOpacity style={styles.imagePreviewClose} onPress={closePreview}>
              <MaterialIcons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            {!!getFullImageUrl(previewImageUrl) && (
              <PinchGestureHandler
                onGestureEvent={onPinchEvent}
                onHandlerStateChange={handlePinchStateChange}
              >
                <Animated.Image
                  source={{ uri: getFullImageUrl(previewImageUrl)! }}
                  style={[styles.imagePreviewImage, { transform: [{ scale: imageScale }] }]}
                  resizeMode="contain"
                />
              </PinchGestureHandler>
            )}
          </View>
        </Modal>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 14 },
  description: { fontSize: 14, lineHeight: 20 },
  mapContainer: { height: 260, borderRadius: 30, overflow: 'hidden', borderWidth: 1 },
  actionsContainer: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
    gap: 10,
  },
  actionsHeader: {
    marginBottom: 2,
  },
  actionsHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  actionsHeaderHint: {
    fontSize: 12,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 40,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 62,
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  background: { flex: 1, padding: 16, gap: 12 },
  backgroundImage: { opacity: 1, transform: [{ scale: 1.5 }, { translateY: 40 }] },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  chatToggle: {
    position: 'absolute',
    top: 16,
    right: 20,
    zIndex: 4,
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
  },
  chatOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 12,
  },
  chatPanel: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
  },
  chatAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  chatAttachmentImage: {
    width: 80,
    height: 60,
    borderRadius: 16,
  },
  chatAttachmentRemove: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 16,
  },
  chatImageButton: {
    marginRight: 8,
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#6c2eb7',
  },
  chatComposer: {
    flexDirection: 'row',
    marginTop: 8,
    alignItems: 'center',
  },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreviewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  imagePreviewImage: {
    width: '92%',
    height: '80%',
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 48,
    right: 18,
    padding: 8,
    zIndex: 2,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chatClose: {
    padding: 6,
    borderRadius: 18,
  },
  chatBubble: {
    padding: 8,
    borderRadius: 20,
    flexShrink: 1,
    overflow: 'hidden',
  },
  chatBubbleWithImage: {
    width: 216,
  },
  chatMessageImage: {
    marginTop: 6,
    width: '100%',
    height: 120,
    borderRadius: 16,
  },
  chatMetaText: {
    fontSize: 12,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  chatTimeText: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
});
