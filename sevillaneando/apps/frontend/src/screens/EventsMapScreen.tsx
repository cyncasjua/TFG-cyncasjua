import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, Platform } from 'react-native';
import MapView, { Marker, Circle, Callout, UrlTile } from 'react-native-maps';
import Slider from '@react-native-community/slider';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getEvents, getErrorMessage } from '../services';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { ThemedView, ThemedText } from '../components';
import type { Event } from '../types/event';
import { reportError } from '../utils/telemetry';
import { haversineDistanceKm, OSM_TILE_URL_TEMPLATE, SEVILLE_COORDINATES } from '../utils/map';

type Props = NativeStackScreenProps<RootStackParamList, 'EventsMap'>;

type EventWithDistance = Event & { distance?: number };

export const EventsMapScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  const [events, setEvents] = useState<EventWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(1000);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const getMarkerColor = (distance?: number): string => {
    if (!distance || distance === Infinity) return '#9370DB';
    if (distance < 1) return '#4CAF50';
    if (distance < 3) return '#FFC107';
    if (distance < 5) return '#FF9800';
    return '#F44336';
  };

  const UserLocationMarker = () => (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#6c2eb7',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 6,
      }}
    >
      <MaterialIcons name="person-pin" size={20} color="#fff" />
    </View>
  );

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const userLon = user?.ubicacion?.coordinates?.[0];
        const userLat = user?.ubicacion?.coordinates?.[1];
        const hasLocation = userLat != null && userLon != null;

        const { events: remote } = await getEvents(
          user?.id,
          hasLocation ? { lat: userLat, lng: userLon } : undefined,
        );

        if (hasLocation) {
          const eventsWithDistance = remote.map((event) => {
            const serverDist = (event as any).distanceKm;
            if (serverDist != null) return { ...event, distance: Number(serverDist) };
            if (!event.location?.coordinates || event.location.coordinates.length !== 2) {
              return { ...event, distance: Infinity };
            }
            return {
              ...event,
              distance: haversineDistanceKm(
                { latitude: userLat, longitude: userLon },
                { latitude: event.location.coordinates[1], longitude: event.location.coordinates[0] },
              ),
            };
          });
          setEvents(eventsWithDistance);
        } else {
          setEvents(remote);
        }
      } catch (err) {
        reportError('events-map.fetch-events', `Error cargando eventos: ${getErrorMessage(err)}`, err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [user]);

  const userLat = user?.ubicacion?.coordinates?.[1] ?? SEVILLE_COORDINATES.latitude;
  const userLon = user?.ubicacion?.coordinates?.[0] ?? SEVILLE_COORDINATES.longitude;

  const hasUserLocation = user?.ubicacion?.coordinates && user.ubicacion.coordinates.length === 2;

  return (
    <ThemedView style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: userLat,
          longitude: userLon,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        <UrlTile urlTemplate={OSM_TILE_URL_TEMPLATE} maximumZ={19} />
        {hasUserLocation && (
          <>
            <Marker coordinate={{ latitude: userLat, longitude: userLon }} title="Tu ubicación">
              <UserLocationMarker />
              <Callout>
                <View
                  style={{
                    backgroundColor: '#ffd700',
                    borderRadius: 16,
                    padding: 6,
                    minWidth: 100,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontWeight: 'bold', fontSize: 12, color: '#333' }}>📍 Tú</Text>
                </View>
              </Callout>
            </Marker>
            <Circle
              center={{ latitude: userLat, longitude: userLon }}
              radius={radius}
              strokeColor="rgba(108, 46, 183, 1)"
              fillColor="rgba(108, 46, 183, 0.4)"
            />
          </>
        )}

        {events
          .filter((ev) => ev.location && ev.location.coordinates && ev.location.coordinates.length === 2)
          .map((event) => {
            const descriptionPreview = event.description?.split('\n')[0]?.substring(0, 60) || 'Sin descripción';
            const isAndroid = Platform.OS === 'android';

            return (
              <Marker
                key={event.id}
                coordinate={{
                  latitude: event.location!.coordinates[1],
                  longitude: event.location!.coordinates[0],
                }}
                title={isAndroid ? undefined : event.title}
                description={isAndroid ? undefined : descriptionPreview}
                pinColor={getMarkerColor(event.distance)}
                onPress={() => {
                  if (isAndroid) {
                    setSelectedEventId(event.id);
                  }
                }}
                onCalloutPress={() => !isAndroid && navigation.navigate('EventDetail', { event })}
              >
                {!isAndroid && (
                  <Callout tooltip>
                      <View
                        style={{
                          backgroundColor: theme === 'dark' ? '#000' : '#fff',
                          borderRadius: 12,
                          padding: 10,
                          width: 350,
                          maxWidth: 350,
                          shadowColor: '#000',
                          shadowOpacity: 0.25,
                          shadowRadius: 6,
                          shadowOffset: { width: 0, height: 2 },
                          elevation: 6,
                        }}
                      >
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => navigation.navigate('EventDetail', { event })}
                        >
                          <Text
                            style={{
                              fontWeight: 'bold',
                              fontSize: 13,
                              marginBottom: 4,
                              color: theme === 'dark' ? '#fff' : '#222',
                              flexShrink: 1,
                            }}
                            numberOfLines={3}
                            ellipsizeMode="tail"
                          >
                            {event.title}
                          </Text>

                          {event.description && (
                            <Text
                              style={{
                                fontSize: 11,
                                color: theme === 'dark' ? '#ddd' : '#555',
                                marginBottom: 4,
                                lineHeight: 15,
                              }}
                              numberOfLines={2}
                              ellipsizeMode="tail"
                            >
                              {descriptionPreview}
                            </Text>
                          )}

                          <Text
                            style={{
                              fontSize: 10,
                              color: theme === 'dark' ? '#bbb' : '#777',
                              marginBottom: 3,
                            }}
                            numberOfLines={2}
                          >
                            📍 {event.address}
                          </Text>

                          {event.distance !== undefined && event.distance !== Infinity && (
                            <Text style={{ fontSize: 10, fontWeight: '600', color: '#6c2eb7', marginBottom: 2 }}>
                              📏 {event.distance.toFixed(1)} km
                            </Text>
                          )}

                          <Text style={{ fontSize: 9, color: theme === 'dark' ? '#aaa' : '#999', fontStyle: 'italic' }}>
                            Toca para ver detalles
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </Callout>
                )}
              </Marker>
            );
          })}
      </MapView>

      {Platform.OS === 'android' && selectedEventId && (
        (() => {
          const selectedEvent = events.find(e => e.id === selectedEventId);
          if (!selectedEvent) return null;
          const descriptionPreview = selectedEvent.description?.split('\n')[0]?.substring(0, 60) || 'Sin descripción';

          return (
            <View
              style={{
                position: 'absolute',
                top: 130,
                left: 12,
                right: 12,
                backgroundColor: theme === 'dark' ? '#000000' : '#fff',
                borderRadius: 16,
                padding: 8,
                shadowColor: '#000',
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
                maxHeight: 250,
              }}
            >
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: theme === 'dark' ? '#333' : '#f0f0f0',
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 10,
                }}
                onPress={() => setSelectedEventId(null)}
              >
                <MaterialIcons name="close" size={14} color={theme === 'dark' ? '#fff' : '#333'} />
              </TouchableOpacity>

              <Text
                style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 3, color: theme === 'dark' ? '#fff' : '#333', paddingRight: 20 }}
                numberOfLines={2}
              >
                {selectedEvent.title}
              </Text>

              {selectedEvent.description && (
                <Text
                  style={{ fontSize: 10, color: theme === 'dark' ? '#ddd' : '#555', marginBottom: 3, lineHeight: 14 }}
                  numberOfLines={2}
                >
                  {descriptionPreview}
                </Text>
              )}

              <Text style={{ fontSize: 9, color: theme === 'dark' ? '#bbb' : '#888', marginBottom: 3 }}>
                📍 {selectedEvent.address}
              </Text>

              {selectedEvent.distance !== undefined && selectedEvent.distance !== Infinity && (
                <Text style={{ fontSize: 10, fontWeight: '600', color: '#6c2eb7', marginBottom: 6 }}>
                  📏 {selectedEvent.distance.toFixed(1)} km
                </Text>
              )}

              <TouchableOpacity
                onPress={() => navigation.navigate('EventDetail', { event: selectedEvent })}
                style={{
                  backgroundColor: '#6c2eb7',
                  borderRadius: 6,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>
                  Ver detalles
                </Text>
              </TouchableOpacity>
            </View>
          );
        })()
      )}

      {hasUserLocation && (
        <ThemedView style={[styles.radiusBox, { backgroundColor: colors.card }]}>
          <ThemedText style={{ fontSize: 12, color: colors.text }}>
            Radio: {(radius / 1000).toFixed(1)} km
          </ThemedText>
          <Slider
            style={{ width: '100%' }}
            minimumValue={200}
            maximumValue={5000}
            step={100}
            value={radius}
            onValueChange={setRadius}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
          />
        </ThemedView>
      )}

      <TouchableOpacity
        style={[styles.closeButton, { backgroundColor: colors.card }]}
        onPress={() => navigation.goBack()}
      >
        <MaterialIcons name="close" size={28} color={colors.text} />
      </TouchableOpacity>

      {!hasUserLocation && (
        <ThemedView style={[styles.infoBox, { backgroundColor: colors.card }]}>
          <MaterialIcons name="info" size={20} color={colors.primary} />
          <ThemedText style={{ marginLeft: 8, fontSize: 12, color: colors.primary }}>
            Configura tu ubicación para ver los eventos en el mapa
          </ThemedText>
        </ThemedView>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  infoBox: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  radiusBox: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 16,
  },
});
