import React, { useMemo, useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { Linking, Platform, StyleSheet, ImageBackground, View } from 'react-native';
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

type Props = NativeStackScreenProps<RootStackParamList, 'EventDetail'>;

const uploadProbe = async () => {
  try {
    const storageRef = ref(storage, 'demo.txt');
    await uploadString(storageRef, 'Contenido de prueba', 'raw');
    const url = await getDownloadURL(storageRef);
    console.log('Archivo subido:', url);
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
  usuario?: { nombre?: string; firebaseUid?: string };
};

export const EventDetailScreen: React.FC<Props> = ({ route }) => {
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
  const socketRef = useRef<Socket | null>(null);

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
                {event.precio === 0 ? 'Gratis' : `${event.precio} €`}
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
                <TouchableOpacity
                  onPress={() => setIsChatOpen(false)}
                  style={styles.chatClose}
                >
                  <MaterialIcons name="close" size={20} color={colors.text} />
                </TouchableOpacity>
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
                          padding: 8,
                          borderRadius: 10,
                          maxWidth: '85%',
                          backgroundColor: isOwn ? '#6c2eb7' : colors.card,
                        }}
                      >
                        <ThemedTextSecondary style={{ fontSize: 12, color: nameColor }}>
                          {isOwn ? 'Tu' : item.usuario?.nombre ?? 'Anonimo'}
                        </ThemedTextSecondary>
                        <ThemedText style={{ color: messageColor }}>{item.contenido}</ThemedText>
                        <ThemedTextSecondary
                          style={{
                            fontSize: 11,
                            marginTop: 4,
                            color: colors.text + '99',
                          }}
                        >
                          {dayjs(item.fechaCreacion).format('HH:mm')}
                        </ThemedTextSecondary>
                      </ThemedView>
                    </ThemedView>
                  );
                })}
              </ScrollView>
              <ThemedView style={{ flexDirection: 'row', marginTop: 8 }}>
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
                    if (!input.trim() || !socketRef.current) return;
                    socketRef.current.emit('chat_message', {
                      eventId: event.id,
                      text: input.trim(),
                    });
                    setInput('');
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
        )}
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
  background: { flex: 1, padding: 16, gap: 12 },
  backgroundImage: { opacity: 1, transform: [{ scale: 1.5 }, { translateY: 40 }] },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  chatToggle: {
    position: 'absolute',
    top: 8,
    right: 12,
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
