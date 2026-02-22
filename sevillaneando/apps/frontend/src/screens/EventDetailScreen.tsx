import React, { useMemo, useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import {
  Linking,
  Platform,
  StyleSheet,
  ImageBackground,
  View,
  Image,
  Modal,
  Animated,
  Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import dayjs from 'dayjs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useNsfwGuard } from '../hooks/useNsfwGuard';
import { useTheme } from '../hooks/useTheme';
import {
  ThemedButton,
  ThemedText,
  ThemedTextSecondary,
  ThemedTitle,
  ThemedView,
} from '../components';
import type { Event } from '../types/event';
import { storage } from '../firebase/config';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { useIsFocused } from '@react-navigation/native';
import { TextInput, TouchableOpacity } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import * as ImagePicker from 'expo-image-picker';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
import { PublicUser } from '../types/user';
import { getFullImageUrl } from '../utils/imageUrl';
import { attendEvent, getEventAttendees, getMyAttendance, unattendEvent } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'EventDetail'>;

const uploadProbe = async () => {
  try {
    const storageRef = ref(storage, 'demo.txt');
    await uploadString(storageRef, 'Contenido de prueba', 'raw');
    const url = await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error al subir archivo:', error);
  }
};

function parsePoint(event: Event) {
  if (event.latitude !== undefined && event.longitude !== undefined) {
    return { latitude: event.latitude, longitude: event.longitude };
  }
  if (event.location) {
    if (typeof event.location === 'string') {
      const locationStr: string = event.location;
      const match = locationStr.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
      if (match) {
        return { latitude: parseFloat(match[2]), longitude: parseFloat(match[1]) };
      }
    } else if (
      typeof event.location === 'object' &&
      event.location.type === 'Point' &&
      Array.isArray(event.location.coordinates) &&
      event.location.coordinates.length === 2
    ) {
      return { latitude: event.location.coordinates[1], longitude: event.location.coordinates[0] };
    }
  }
  return null;
}

type ChatMessage = {
  id: string;
  eventId: string;
  contenido: string;
  fechaCreacion: string;
  usuario?: { id?: string; nombre?: string; firebaseUid?: string; fotoPerfil?: string };
  imageUrl?: string | null;
};

export const EventDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { event } = route.params;
  const { evaluateImage } = useNsfwGuard();
  const { colors, theme } = useTheme();
  const coords = useMemo(() => parsePoint(event), [event]);
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
  const [attendees, setAttendees] = useState<PublicUser[]>([]);
  const [isAttending, setIsAttending] = useState(false);
  const [attendeesError, setAttendeesError] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const lastScaleRef = useRef(1);
  const imageScale = Animated.multiply(baseScale, pinchScale);

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
      .catch(() => {
        if (!mounted) return;
        setAttendeesError('No se pudo cargar la lista de asistentes');
      });

    return () => {
      mounted = false;
    };
  }, [event.id, token]);

  const handleToggleAttend = async () => {
    if (!token) return;
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
    } catch {
      setAttendeesError('No se pudo actualizar tu asistencia');
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

  useEffect(() => {
    if (!token) return;
    const socket = io(process.env.EXPO_PUBLIC_API_URL, {
      auth: { token },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_room', event.id);
    });

    socket.on('chat_history', (history: ChatMessage[]) => {
      setMessages(history);
    });

    socket.on('chat_message', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on('delete_event_message_success', (messageId: string) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    });

    socket.on('chat_error', (err: { message: string }) => {
      setChatError(err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [event.id, token]);

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
      setChatError('Necesitas iniciar sesion para subir imagenes');
      return;
    }
    if (!asset?.uri) return;

    try {
      setChatError('');
      setPendingImageLocalUri(asset.uri);
      setIsUploadingImage(true);

      const uriParts = asset.uri.split('.');
      const ext = uriParts.length > 1 ? uriParts[uriParts.length - 1] : 'jpg';
      const mimeType = asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const name = asset.fileName ?? `chat-${Date.now()}.${ext}`;

      const formData = new FormData();
      formData.append('file', { uri: asset.uri, name, type: mimeType } as any);

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
      console.error(error);
      setChatError('Error al subir la imagen');
      setPendingImageLocalUri(null);
      setPendingImageUrl(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handlePickImage = async () => {
    if (!token) {
      setChatError('Necesitas iniciar sesion para subir imagenes');
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      await uploadChatImage(asset);
    } catch (error) {
      console.error(error);
      setChatError('Error al seleccionar la imagen');
    }
  };

  const handleTakePhoto = async () => {
    if (!token) {
      setChatError('Necesitas iniciar sesion para subir imagenes');
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
      console.error(error);
      setChatError('Error al abrir la camara');
    }
  };

  const handleDeleteEventMessage = (messageId: string) => {
    Alert.alert(
      'Borrar mensaje',
      '¿Estás seguro de que quieres borrar este mensaje?',
      [
        { text: 'Cancelar', onPress: () => { }, style: 'cancel' },
        {
          text: 'Borrar',
          onPress: () => {
            if (socketRef.current) {
              socketRef.current.emit('delete_event_message', { eventId: event?.id, messageId });
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

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
      source={event.imagen ? { uri: event.imagen } : require('../../assets/splash.png')}
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
            backgroundColor:
              theme === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.45)',
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
          <ThemedView
            style={[
              { borderRadius: 18, padding: 16, marginBottom: 12 },
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
              {event.description}
            </ThemedText>
            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialIcons name="event" size={16} color="#6c2eb7" />
              <ThemedTextSecondary style={{ marginLeft: 4 }}>
                {dayjs(event.fechaInicio).format('DD/MM/YYYY HH:mm')} -{' '}
                {dayjs(event.fechaFin).format('DD/MM/YYYY HH:mm')}
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
            <ThemedView style={{ alignItems: 'flex-end', marginBottom: 8 }}>
              <ThemedText
                style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: '#fff',
                  backgroundColor: '#6c2eb7',
                  paddingHorizontal: 16,
                  paddingVertical: 6,
                  borderRadius: 14,
                  overflow: 'hidden',
                  alignSelf: 'flex-end',
                }}
              >
                {
                  (() => {
                    console.log('EventDetail - Precio:', event.precio, 'Min:', event.precioMin, 'Max:', event.precioMax);
                    if (event.precio != null && event.precio !== 0)
                      return `${event.precio} €`;
                    if (event.precioMin != null && event.precioMax != null)
                      return `${event.precioMin}€ - ${event.precioMax}€`;
                    return 'Gratis';
                  })()
                }
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
              <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
              <Marker coordinate={coords} title={event.title} />
            </MapView>
          </ThemedView>
          <ThemedButton
            title={isAttending ? 'Ya no asistiré' : 'Asistiré'}
            onPress={handleToggleAttend}
          />
          {!!attendeesError && (
            <ThemedTextSecondary style={{ color: '#c0392b', marginTop: 6 }}>
              {attendeesError}
            </ThemedTextSecondary>
          )}
          <ThemedView style={{ marginTop: 12 }}>
            <ThemedTextSecondary style={{ marginBottom: 6 }}>
              Asistentes ({attendees.length})
            </ThemedTextSecondary>
            <ThemedView style={{ gap: 8 }}>
              {attendees.map((att) => (
                <TouchableOpacity
                  key={att.id}
                  onPress={() => navigation.navigate('UserProfile', { userId: att.id })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, backgroundColor: colors.card, borderRadius: 8 }}
                >
                  {att.fotoPerfil ? (
                    <Image source={{ uri: getFullImageUrl(att.fotoPerfil) || att.fotoPerfil }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                  ) : (
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#d0d0d0' }} />
                  )}
                  <ThemedText>{att.nombre}</ThemedText>
                </TouchableOpacity>
              ))}
            </ThemedView>
          </ThemedView>
          <ThemedButton title="Abrir en Google/Apple Maps" onPress={openExternalNavigation} />
          <ThemedButton
            title="Probar moderación NSFW (demo)"
            variant="secondary"
            onPress={async () => {
              const safe = await evaluateImage();
              console.log('Imagen segura:', safe);
            }}
          />
          <ThemedButton title="Probar subida a Storage" variant="secondary" onPress={uploadProbe} />
        </ScrollView>
        {isChatOpen && (
          <View style={styles.chatOverlay}>
            <ThemedView style={[styles.chatPanel, { backgroundColor: colors.card }]}
            >
              <ThemedView style={styles.chatHeader}>
                <ThemedTitle>Chat del evento</ThemedTitle>
              </ThemedView>
              {!!chatError && (
                <ThemedTextSecondary style={{ marginBottom: 6, color: '#c0392b' }}>
                  {chatError}
                </ThemedTextSecondary>
              )}
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
                {messages.map((item) => {
                  const isOwn = item.usuario?.firebaseUid === user?.firebaseUid;
                  const nameColor = theme === 'dark' ? '#9bbcff' : '#3b5bdb';
                  const messageColor = theme === 'dark' ? '#e6e8ef' : '#1f2937';

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
                            {item.usuario?.fotoPerfil ? (
                              <Image
                                source={{ uri: getFullImageUrl(item.usuario.fotoPerfil) || item.usuario.fotoPerfil }}
                                style={{ width: 24, height: 24, borderRadius: 12 }}
                              />
                            ) : (
                              <View
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 12,
                                  backgroundColor: '#d0d0d0',
                                }}
                              />
                            )}
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          onLongPress={() => isOwn && handleDeleteEventMessage(item.id)}
                          activeOpacity={0.9}
                          style={{
                            padding: 8,
                            borderRadius: 10,
                            backgroundColor: isOwn ? '#6c2eb7' : colors.card,
                            flex: 1,
                          }}
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
                              style={{ fontSize: 12, color: nameColor }}
                            >
                              {isOwn ? 'Tu' : item.usuario?.nombre ?? 'Anonimo'}
                            </ThemedTextSecondary>
                          </TouchableOpacity>
                          {!!item.contenido?.trim() && (
                            <ThemedText style={{ color: messageColor }}>
                              {item.contenido}
                            </ThemedText>
                          )}
                          {!!item.imageUrl && (
                            <TouchableOpacity
                              onPress={() => setPreviewImageUrl(item.imageUrl ?? null)}
                            >
                              <Image
                                source={{ uri: item.imageUrl }}
                                style={styles.chatMessageImage}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          )}
                          <ThemedTextSecondary
                            style={{
                              fontSize: 11,
                              marginTop: 4,
                              color: colors.text + '99',
                            }}
                          >
                            {dayjs(item.fechaCreacion).format('HH:mm')}
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
                              borderRadius: 6,
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
              {!!pendingImageLocalUri && (
                <ThemedView style={styles.chatAttachment}>
                  <Image source={{ uri: pendingImageLocalUri }} style={styles.chatAttachmentImage} />
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
              <ThemedView style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
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
                    borderRadius: 10,
                    padding: 10,
                    color: colors.text,
                  }}
                  placeholderTextColor={colors.text + '99'}
                />
                <TouchableOpacity
                  onPress={() => {
                    const trimmedText = input.trim();
                    if ((!trimmedText && !pendingImageUrl) || !socketRef.current) return;
                    socketRef.current.emit('chat_message', {
                      eventId: event.id,
                      text: trimmedText,
                      imageUrl: pendingImageUrl ?? undefined,
                    });
                    setInput('');
                    setPendingImageLocalUri(null);
                    setPendingImageUrl(null);
                  }}
                  style={{
                    marginLeft: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: '#6c2eb7',
                    borderRadius: 10,
                  }}
                >
                  <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Enviar</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
          </View>
        )
        }
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
            {!!previewImageUrl && (
              <PinchGestureHandler
                onGestureEvent={onPinchEvent}
                onHandlerStateChange={handlePinchStateChange}
              >
                <Animated.Image
                  source={{ uri: previewImageUrl }}
                  style={[styles.imagePreviewImage, { transform: [{ scale: imageScale }] }]}
                  resizeMode="contain"
                />
              </PinchGestureHandler>
            )}
          </View>
        </Modal>
      </SafeAreaView >
    </ImageBackground >
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 14 },
  description: { fontSize: 14, lineHeight: 20 },
  mapContainer: { height: 260, borderRadius: 30, overflow: 'hidden', borderWidth: 1 },
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
  chatMessageImage: {
    marginTop: 6,
    width: 200,
    height: 120,
    borderRadius: 10,
  },
  chatAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  chatAttachmentImage: {
    width: 80,
    height: 60,
    borderRadius: 8,
  },
  chatAttachmentRemove: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 10,
  },
  chatImageButton: {
    marginRight: 8,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6c2eb7',
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
    borderRadius: 12,
  },
});
