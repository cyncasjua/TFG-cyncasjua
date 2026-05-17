import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { ThemedView, ThemedText, ThemedTextSecondary, ThemedTitle } from '../components';
import { useTheme } from '../hooks/useTheme';
import { getEventById, getErrorMessage, type RecommendedRoute } from '../services';
import type { Event } from '../types/event';
import { formatSevillaTime } from '../utils/sevillaTime';
import { reportError } from '../utils/telemetry';
import { haversineDistanceKm, SEVILLE_COORDINATES } from '../utils/map';

type RoutePreviewStackParamList = {
  RoutePreview: { routePlan: RecommendedRoute };
  EventDetail: { event: Event };
};

type Props = NativeStackScreenProps<RoutePreviewStackParamList, 'RoutePreview'>;

export const RoutePreviewScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors, theme } = useTheme();
  const { routePlan } = route.params;

  const coordinates = useMemo(
    () =>
      routePlan.trayecto.map((point) => ({
        latitude: point.coordinates[1],
        longitude: point.coordinates[0],
      })),
    [routePlan.trayecto]
  );

  const initialRegion = useMemo(() => {
    if (coordinates.length === 0) {
      return {
        latitude: SEVILLE_COORDINATES.latitude,
        longitude: SEVILLE_COORDINATES.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      };
    }

    const lats = coordinates.map((c) => c.latitude);
    const lngs = coordinates.map((c) => c.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.6),
      longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.6),
    };
  }, [coordinates]);

  const openEvent = async (eventId: string) => {
    try {
      const event = await getEventById(eventId);
      navigation.navigate('EventDetail', { event });
    } catch (error) {
      reportError(
        'route-preview.open-event',
        `No se pudo abrir evento desde ruta: ${getErrorMessage(error)}`,
        error
      );
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes} min`;
  };

  const estimateWalkingMinutes = (distanceKm: number) => {
    const minutes = Math.round((distanceKm / 5.04) * 60);
    return Math.max(1, minutes);
  };

  const estimateDrivingMinutes = (distanceKm: number) => {
    const minutes = Math.round((distanceKm / 35) * 60);
    return Math.max(1, minutes);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedView
        style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <ThemedTitle style={styles.summaryTitle}>
          {routePlan.day === 'Sin fecha'
            ? 'Ruta sin fecha concreta'
            : `Ruta de ${dayjs(routePlan.day).locale('es').format('dddd DD/MM')}`}
        </ThemedTitle>
        <ThemedTextSecondary>
          {routePlan.eventos.length} paradas · {routePlan.distanceTotalKm.toFixed(1)} km ·{' '}
          {formatDuration(routePlan.temporizacionMinutos)}
        </ThemedTextSecondary>
        <ThemedTextSecondary>Score medio: {routePlan.scoreMedio.toFixed(2)}</ThemedTextSecondary>
        {routePlan.quality != null && (
          <ThemedTextSecondary>
            Calidad de ruta: {routePlan.quality.toFixed(0)}%
          </ThemedTextSecondary>
        )}
      </ThemedView>

      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        customMapStyle={theme === 'dark' ? DARK_MAP_STYLE : []}
      >
        {coordinates.length >= 2 && (
          <Polyline
            coordinates={coordinates}
            strokeColor={colors.primary}
            strokeWidth={4}
            lineDashPattern={[1]}
          />
        )}

        {coordinates.map((coordinate, index) => (
          <Marker
            key={`${routePlan.day}-${index}`}
            coordinate={coordinate}
            title={`Parada ${index + 1}`}
            tracksViewChanges={false}
          >
            <View style={[styles.markerBubble, { backgroundColor: colors.primary }]}>
              <ThemedText style={styles.markerLabel}>{index + 1}</ThemedText>
            </View>
          </Marker>
        ))}
      </MapView>

      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.timelineContent}
      >
        {routePlan.day === 'Sin fecha' && (
          <ThemedView
            style={{
              padding: 12,
              marginBottom: 12,
              backgroundColor: colors.card,
              borderRadius: 8,
              borderLeftWidth: 3,
              borderLeftColor: colors.primary,
            }}
          >
            <ThemedText style={{ fontWeight: '600', marginBottom: 4 }}>
              ℹ️ Eventos con múltiples fechas
            </ThemedText>
            <ThemedTextSecondary>
              Estos eventos tienen varias fechas y horas disponibles. Mire la disponibilidad de
              horarios en la web.
            </ThemedTextSecondary>
          </ThemedView>
        )}
        {routePlan.eventos.map((event, index) => {
          const isLast = index === routePlan.eventos.length - 1;
          const currentPoint = coordinates[index];
          const nextPoint = !isLast ? coordinates[index + 1] : undefined;
          const segmentDistanceKm =
            currentPoint && nextPoint ? haversineDistanceKm(currentPoint, nextPoint) : null;

          const nextEvent = !isLast ? routePlan.eventos[index + 1] : null;
          const currentEnd = event.fechaFin ? new Date(event.fechaFin).getTime() : null;
          const nextStart = nextEvent?.fechaInicio
            ? new Date(nextEvent.fechaInicio).getTime()
            : null;
          const transitionGapMin =
            nextStart !== null && currentEnd !== null && Number.isFinite(currentEnd)
              ? Math.max(0, Math.round((nextStart - currentEnd) / (1000 * 60)))
              : null;

          return (
            <View key={event.id}>
              <View style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineDot, { borderColor: colors.primary }]} />
                  {!isLast && (
                    <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                  )}
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.eventCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={() => openEvent(event.id)}
                >
                  <View style={styles.eventTitleRow}>
                    <ThemedText style={styles.eventTitle}>{event.title}</ThemedText>
                    <MaterialIcons name="open-in-new" size={18} color={colors.primary} />
                  </View>
                  <ThemedTextSecondary numberOfLines={1}>
                    {event.hasMultipleDatesAvailable
                      ? `Consultar fechas · ${event.categoria || 'General'}`
                      : `${formatSevillaTime(event.fechaInicio)} · ${event.categoria || 'General'}`}
                  </ThemedTextSecondary>
                  <ThemedTextSecondary numberOfLines={1}>{event.address}</ThemedTextSecondary>
                  <View style={styles.scoreRow}>
                    <MaterialIcons name="star" size={14} color="#f39c12" />
                    <ThemedTextSecondary>{event.score.toFixed(1)}</ThemedTextSecondary>
                    {event.distanceKm != null && (
                      <>
                        <MaterialIcons
                          name="near-me"
                          size={14}
                          color={colors.primary}
                          style={{ marginLeft: 10 }}
                        />
                        <ThemedTextSecondary>{event.distanceKm.toFixed(1)} km</ThemedTextSecondary>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              {!isLast && segmentDistanceKm != null && (
                <View
                  style={[
                    styles.segmentInfoRow,
                    { borderColor: colors.border, backgroundColor: colors.card },
                  ]}
                >
                  <View style={styles.segmentInfoItem}>
                    <MaterialIcons name="straight" size={14} color={colors.primary} />
                    <ThemedTextSecondary>{segmentDistanceKm.toFixed(2)} km</ThemedTextSecondary>
                  </View>
                  <View style={styles.segmentInfoItem}>
                    <MaterialIcons name="directions-walk" size={14} color={colors.primary} />
                    <ThemedTextSecondary>
                      {formatDuration(estimateWalkingMinutes(segmentDistanceKm))}
                    </ThemedTextSecondary>
                  </View>
                  <View style={styles.segmentInfoItem}>
                    <MaterialIcons name="directions-car" size={14} color={colors.primary} />
                    <ThemedTextSecondary>
                      {formatDuration(estimateDrivingMinutes(segmentDistanceKm))}
                    </ThemedTextSecondary>
                  </View>
                  {transitionGapMin != null && (
                    <View style={styles.segmentInfoItem}>
                      <MaterialIcons name="schedule" size={14} color={colors.primary} />
                      <ThemedTextSecondary>
                        hueco {formatDuration(transitionGapMin)}
                      </ThemedTextSecondary>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryCard: {
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  map: {
    height: 250,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 18,
  },
  markerBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  timelineContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 24,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 10,
  },
  timelineRail: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#fff',
    marginTop: 10,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
    marginBottom: -10,
  },
  eventCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    marginLeft: 6,
  },
  eventTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventTitle: {
    flex: 1,
    marginRight: 8,
    fontSize: 14,
    fontWeight: '700',
  },
  scoreRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentInfoRow: {
    marginLeft: 26,
    marginRight: 2,
    marginBottom: 10,
    marginTop: -2,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  segmentInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1e2430' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1e2430' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ea1b8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2f3b4f' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#b5c5d9' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#263245' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1a28' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#293449' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#36455d' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#1b2533' }] },
];
