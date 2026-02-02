import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import MapView, { Marker, Circle, Callout } from 'react-native-maps';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { getEvents, getErrorMessage } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { ThemedView, ThemedText } from '../components';
import type { Event } from '../types/event';

type Props = NativeStackScreenProps<RootStackParamList, 'EventsMap'>;

type EventWithDistance = Event & { distance?: number };

export const EventsMapScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [events, setEvents] = useState<EventWithDistance[]>([]);
  const [loading, setLoading] = useState(true);

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
        const remote = await getEvents();

        if (user?.ubicacion?.coordinates && user.ubicacion.coordinates.length === 2) {
          const userLon = user.ubicacion.coordinates[0];
          const userLat = user.ubicacion.coordinates[1];

          const eventsWithDistance = remote.map((event) => {
            if (!event.location?.coordinates || event.location.coordinates.length !== 2) {
              return { ...event, distance: Infinity };
            }
            const dist = calculateDistance(
              userLat,
              userLon,
              event.location.coordinates[1],
              event.location.coordinates[0]
            );
            return { ...event, distance: dist };
          });

          setEvents(eventsWithDistance);
        } else {
          setEvents(remote);
        }
      } catch (err) {
        console.error('Error cargando eventos', getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [user]);

  const userLat = user?.ubicacion?.coordinates?.[1] ?? 37.3891;
  const userLon = user?.ubicacion?.coordinates?.[0] ?? -5.9845;

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
        {hasUserLocation && (
          <>
            <Marker coordinate={{ latitude: userLat, longitude: userLon }} title="Tu ubicación">
              <UserLocationMarker />
              <Callout>
                <View
                  style={{
                    backgroundColor: '#ffd700',
                    borderRadius: 8,
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
              radius={1000}
              strokeColor="rgba(108, 46, 183, 0.5)"
              fillColor="rgba(108, 46, 183, 0.1)"
            />
          </>
        )}

        {events
          .filter((ev) => ev.location?.coordinates && ev.location.coordinates.length === 2)
          .map((event) => (
            <Marker
              key={event.id}
              coordinate={{
                latitude: event.location!.coordinates[1],
                longitude: event.location!.coordinates[0],
              }}
              title={event.title}
              onPress={() => navigation.navigate('EventDetail', { event })}
              pinColor={getMarkerColor(event.distance)}
            >
              <Callout tooltip>
                <View
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 8,
                    padding: 8,
                    minWidth: 180,
                    shadowColor: '#000',
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 5,
                  }}
                >
                  <Text
                    style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, color: '#333' }}
                  >
                    {event.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#666', marginBottom: 3 }}>
                    📍 {event.address}
                  </Text>
                  {event.distance !== undefined && event.distance !== Infinity && (
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6c2eb7' }}>
                      📏 {event.distance.toFixed(1)} km
                    </Text>
                  )}
                </View>
              </Callout>
            </Marker>
          ))}
      </MapView>

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
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
