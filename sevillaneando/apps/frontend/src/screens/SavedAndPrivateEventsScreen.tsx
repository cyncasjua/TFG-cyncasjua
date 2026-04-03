import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { RootStackParamList } from '../App';
import { useTheme } from '../hooks/useTheme';
import {
  getErrorMessage,
  getEventByAccessLink,
  getEventById,
  getSavedRecommendedEvents,
  RecommendedEvent,
} from '../services/api';
import { ThemedCard, ThemedText, ThemedTextSecondary, ThemedTitle, ThemedView } from '../components';

const ACCESSED_PRIVATE_LINKS_KEY = 'accessedPrivateLinks';

type Props = NativeStackScreenProps<RootStackParamList, 'SavedAndPrivateEvents'>;

export const SavedAndPrivateEventsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors, theme } = useTheme();
  const mode = route.params?.mode ?? 'both';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedEvents, setSavedEvents] = useState<RecommendedEvent[]>([]);
  const [privateEvents, setPrivateEvents] = useState<RecommendedEvent[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [savedRes, rawPrivateLinks] = await Promise.all([
        getSavedRecommendedEvents(),
        AsyncStorage.getItem(ACCESSED_PRIVATE_LINKS_KEY),
      ]);

      const links: string[] = rawPrivateLinks ? JSON.parse(rawPrivateLinks) : [];
      const privateResults = await Promise.allSettled(links.map((link) => getEventByAccessLink(link)));

      const privateMapped: RecommendedEvent[] = privateResults
        .filter((item): item is PromiseFulfilledResult<any> => item.status === 'fulfilled')
        .map((item) => ({
          id: item.value.id,
          title: item.value.title,
          description: item.value.description,
          fechaInicio: item.value.fechaInicio,
          fechaFin: item.value.fechaFin,
          address: item.value.address,
          categoria: item.value.categoria?.nombre ?? null,
          imagen: item.value.imagen ?? null,
          score: 0,
          distanceKm: null,
          reasons: [],
        }));

      setSavedEvents(savedRes.eventos ?? []);
      setPrivateEvents(privateMapped);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const openEvent = async (event: RecommendedEvent) => {
    try {
      const fullEvent = await getEventById(event.id);
      navigation.navigate('EventDetail', { event: fullEvent });
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err) || 'No se pudo abrir el detalle del evento.');
    }
  };

  const renderList = (title: string, events: RecommendedEvent[]) => (
    <ThemedView style={{ marginBottom: 16 }}>
      <ThemedTitle style={styles.sectionTitle}>{title}</ThemedTitle>
      {events.length === 0 ? (
        <ThemedTextSecondary>No hay eventos en esta lista.</ThemedTextSecondary>
      ) : (
        events.map((event) => {
          const nowMs = Date.now();
          const startMs = new Date(event.fechaInicio).getTime();
          const endMs = new Date(event.fechaFin).getTime();
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
                  source={event.imagen ? { uri: event.imagen } : require('../../assets/splash.png')}
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
                      {dayjs(event.fechaInicio).locale('es').format('DD/MM/YYYY')} - {dayjs(event.fechaFin).locale('es').format('DD/MM/YYYY')}
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
      {(mode === 'both' || mode === 'private') && renderList('Eventos privados accedidos', privateEvents)}
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
    borderRadius: 12,
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
    borderRadius: 8,
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
