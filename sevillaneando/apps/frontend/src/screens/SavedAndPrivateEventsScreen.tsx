import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ImageBackground, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
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
} from '../services/api';
import { formatEventDateRange } from '../utils/sevillaTime';
import { getFullImageUrl } from '../utils/imageUrl';
import type { Event } from '../types/event';
import { ThemedCard, ThemedText, ThemedTextSecondary, ThemedTitle, ThemedView } from '../components';

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
        user?.id ? api.get(`/events/attending/${user.id}`) : Promise.resolve({ data: [] as Event[] }),
      ]);

      const links: string[] = rawPrivateLinks ? JSON.parse(rawPrivateLinks) : [];
      const privateResults = await Promise.allSettled(links.map((link) => getEventByAccessLink(link)));

      const linkedPrivate = privateResults
        .filter((item): item is PromiseFulfilledResult<Event> => item.status === 'fulfilled')
        .map((item) => item.value);

      const mergedPrivate = [...(createdRes.data as Event[]), ...linkedPrivate]
        .filter((event, index, arr) => event?.privado && index === arr.findIndex((e) => e.id === event.id));

      const mergedJoined = (joinedRes.data as Event[])
        .filter((event, index, arr) => event && index === arr.findIndex((e) => e.id === event.id));

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
    }, [loadData]),
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

  const renderPrivateList = (title: string, events: Event[]) => (
    <ThemedView style={{ marginBottom: 16 }}>
      <ThemedTitle style={styles.sectionTitle}>{title}</ThemedTitle>
      {events.length === 0 ? (
        <ThemedTextSecondary>No hay eventos en esta lista.</ThemedTextSecondary>
      ) : (
        events.map((event) => {
          const nowMs = Date.now();
          const startMs = event.fechaInicio ? new Date(event.fechaInicio).getTime() : NaN;
          const endMs = event.fechaFin ? new Date(event.fechaFin).getTime() : NaN;
          const isOngoing = Number.isFinite(startMs) && Number.isFinite(endMs)
            ? nowMs >= startMs && nowMs <= endMs
            : false;
          const isWithinWeek = Number.isFinite(startMs)
            ? startMs > nowMs && startMs - nowMs <= 7 * 24 * 60 * 60 * 1000
            : false;

          return (
            <TouchableOpacity key={`${title}-${event.id}`} onPress={() => { openPrivateEvent(event); }} activeOpacity={0.86}>
              <ThemedCard style={{ marginBottom: 8, padding: 0, overflow: 'hidden' }}>
                {isOngoing && (
                  <ThemedText style={[styles.statusBadge, styles.statusOngoing]}>
                    En curso
                  </ThemedText>
                )}
                {!isOngoing && isWithinWeek && (
                  <ThemedText style={[styles.statusBadge, styles.statusSoon]}>
                    En &lt; 7 dias
                  </ThemedText>
                )}

                <ImageBackground
                  source={getFullImageUrl(event.imagen) ? { uri: getFullImageUrl(event.imagen)! } : require('../../assets/splash.png')}
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
                    {event.title}
                  </ThemedText>
                  <ThemedTextSecondary
                    style={{
                      fontSize: 13,
                      color: theme === 'dark' ? '#eee' : '#444',
                      marginLeft: 14,
                      marginBottom: 6,
                      textShadowColor:
                        theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.1)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 2,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {event.address}
                  </ThemedTextSecondary>
                </ImageBackground>

                <ThemedView style={styles.cardDetails}>
                  <ThemedView style={styles.detailRow}>
                    <ThemedTextSecondary>
                      {formatEventDateRange(event.fechaInicio, event.fechaFin)}
                    </ThemedTextSecondary>
                  </ThemedView>
                  <ThemedView style={styles.detailRow}>
                    <ThemedTextSecondary>{event.categoria?.nombre || 'General'}</ThemedTextSecondary>
                  </ThemedView>
                </ThemedView>
              </ThemedCard>
            </TouchableOpacity>
          );
        })
      )}
    </ThemedView>
  );

  const renderList = (title: string, events: RecommendedEvent[]) => (
    <ThemedView style={{ marginBottom: 16 }}>
      <ThemedTitle style={styles.sectionTitle}>{title}</ThemedTitle>
      {events.length === 0 ? (
        <ThemedTextSecondary>No hay eventos en esta lista.</ThemedTextSecondary>
      ) : (
        events.map((event) => {
          const nowMs = Date.now();
          const startMs = event.fechaInicio ? new Date(event.fechaInicio).getTime() : NaN;
          const endMs = event.fechaFin ? new Date(event.fechaFin).getTime() : NaN;
          const isOngoing = Number.isFinite(startMs) && Number.isFinite(endMs)
            ? nowMs >= startMs && nowMs <= endMs
            : false;
          const isWithinWeek = Number.isFinite(startMs)
            ? startMs > nowMs && startMs - nowMs <= 7 * 24 * 60 * 60 * 1000
            : false;

          return (
            <TouchableOpacity key={`${title}-${event.id}`} onPress={() => { openEvent(event); }} activeOpacity={0.86}>
              <ThemedCard style={{ marginBottom: 8, padding: 0, overflow: 'hidden' }}>
                {isOngoing && (
                  <ThemedText style={[styles.statusBadge, styles.statusOngoing]}>
                    En curso
                  </ThemedText>
                )}
                {!isOngoing && isWithinWeek && (
                  <ThemedText style={[styles.statusBadge, styles.statusSoon]}>
                    En &lt; 7 dias
                  </ThemedText>
                )}

                <ImageBackground
                  source={getFullImageUrl(event.imagen) ? { uri: getFullImageUrl(event.imagen)! } : require('../../assets/splash.png')}
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
                    {event.title}
                  </ThemedText>
                  <ThemedTextSecondary
                    style={{
                      fontSize: 13,
                      color: theme === 'dark' ? '#eee' : '#444',
                      marginLeft: 14,
                      marginBottom: 6,
                      textShadowColor:
                        theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.1)',
                      textShadowOffset: { width: 0, height: 1 },
                      textShadowRadius: 2,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {event.address}
                  </ThemedTextSecondary>
                </ImageBackground>

                <ThemedView style={styles.cardDetails}>
                  <ThemedView style={styles.detailRow}>
                    <ThemedTextSecondary>
                      {formatEventDateRange(event.fechaInicio, event.fechaFin)}
                    </ThemedTextSecondary>
                  </ThemedView>
                  <ThemedView style={styles.detailRow}>
                    <ThemedTextSecondary>{event.categoria || 'General'}</ThemedTextSecondary>
                  </ThemedView>
                </ThemedView>
              </ThemedCard>
            </TouchableOpacity>
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
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      {!!error && <ThemedText style={{ color: colors.error, marginBottom: 12 }}>{error}</ThemedText>}
      {(mode === 'both' || mode === 'saved') && renderList('Eventos guardados', savedEvents)}
      {(mode === 'both' || mode === 'private') && renderPrivateList('Eventos privados', privateEvents)}
      {mode === 'joined' && renderPrivateList('Eventos a los que estas apuntado', joinedEvents)}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 8,
  },
  card: {
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
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
  cardDetails: {
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
});
