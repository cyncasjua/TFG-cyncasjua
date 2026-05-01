import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { ThemedView, ThemedText, ThemedTextSecondary, ThemedTitle, ThemedButton } from '../components';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { getRouteById, deleteRoute, rateRoute, getErrorMessage, api, type UserRoute } from '../services/api';
import type { RootStackParamList } from '../App';
import { formatSevillaTime } from '../utils/sevillaTime';
import { reportError } from '../utils/telemetry';
import { OSM_TILE_URL_TEMPLATE, SEVILLE_COORDINATES } from '../utils/map';

type Props = NativeStackScreenProps<RootStackParamList, 'RouteDetail'>;

export const RouteDetailScreen: React.FC<Props> = ({ route: routeParam, navigation }) => {
  const { colors, theme } = useTheme();
  const { user } = useAuth();
  const { routeId } = routeParam.params;

  const [route, setRoute] = useState<UserRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [tempRating, setTempRating] = useState(0);
  const [ratingLoading, setRatingLoading] = useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Detalle de ruta',
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontWeight: 'bold',
        fontSize: 18,
      },
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ paddingHorizontal: 8 }}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
      ),
      headerRight: () => null,
    });
  }, [navigation, colors.primary]);

  useEffect(() => {
    const fetchRoute = async () => {
      setLoading(true);
      try {
        const data = await getRouteById(routeId);
        setRoute(data);

        // Cargar la calificación del usuario
        if (user?.id) {
          try {
            const response = await api.get(`/rutas/${routeId}/mi-calificacion`);
            setUserRating(response.data.calificacion);
          } catch (err) {
            // Si el usuario no está autenticado, no hacer nada
            setUserRating(null);
          }
        }
      } catch (error) {
        reportError('route-detail.fetch', getErrorMessage(error), error);
        Alert.alert('Error', getErrorMessage(error));
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    fetchRoute();
  }, [routeId, navigation, user?.id]);

  const coordinates = useMemo(() => {
    if (!route || !route.trayecto) return [];
    return route.trayecto.map((point: any) => ({
      latitude: point.coordinates[1],
      longitude: point.coordinates[0],
    }));
  }, [route]);

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

  const handleDeleteRoute = () => {
    Alert.alert(
      'Eliminar ruta',
      '¿Estás seguro de que deseas eliminar esta ruta?',
      [
        {
          text: 'Cancelar',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteRoute(routeId);
              Alert.alert('Éxito', 'Ruta eliminada correctamente');
              navigation.goBack();
            } catch (error) {
              reportError('route-detail.delete', getErrorMessage(error), error);
              Alert.alert('Error', getErrorMessage(error));
            } finally {
              setDeleting(false);
            }
          },
          style: 'destructive',
        },
      ],
    );
  };

  const handleRateRoute = async (stars: number) => {
    setRatingLoading(true);
    try {
      const updated = await rateRoute(routeId, stars);
      setRoute(updated);
      setUserRating(stars);
      setTempRating(0);
      Alert.alert('Éxito', `Ruta calificada con ${stars} estrella${stars > 1 ? 's' : ''}`);
    } catch (error) {
      reportError('route-detail.rate', getErrorMessage(error), error);
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setRatingLoading(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

  if (!route) {
    return null;
  }

  const isOwner = user?.id === route.creador.id;

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header Card */}
        <ThemedView
          style={[
            styles.headerCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <ThemedTitle>{route.titulo}</ThemedTitle>
              <ThemedTextSecondary>
                {route.secuenciaEventos.length} paradas · {route.temporizacion} minutos
              </ThemedTextSecondary>
            </View>
            {isOwner && (
              <TouchableOpacity disabled={deleting} onPress={handleDeleteRoute}>
                <MaterialIcons
                  name="delete"
                  size={24}
                  color={deleting ? colors.textSecondary : colors.primary}
                />
              </TouchableOpacity>
            )}
          </View>

          {route.descripcion && <ThemedTextSecondary style={{ marginTop: 12 }}>{route.descripcion}</ThemedTextSecondary>}

          {/* Creador */}
          <View style={[styles.creadorRow, { marginTop: 12, paddingTop: 12, borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <ThemedTextSecondary style={{ fontSize: 12 }}>Creado por</ThemedTextSecondary>
              <ThemedText>{route.creador.nombre}</ThemedText>
            </View>
            <View>
              <ThemedTextSecondary style={{ fontSize: 12, textAlign: 'right' }}>
                {dayjs(route.fechaCreacion).locale('es').format('DD MMM YYYY')}
              </ThemedTextSecondary>
            </View>
          </View>
        </ThemedView>

        {/* Mapa */}
        <ThemedView
          style={[
            styles.section,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <MapView style={styles.map} initialRegion={initialRegion} scrollEnabled={true} zoomEnabled={true}>
            <UrlTile urlTemplate={OSM_TILE_URL_TEMPLATE} maximumZ={19} />
            {coordinates.length >= 2 && (
              <Polyline
                coordinates={coordinates}
                strokeColor={colors.primary}
                strokeWidth={4}
                lineDashPattern={[1]}
              />
            )}

            {coordinates.map((coord, index) => (
              <Marker key={`${routeId}-${index}`} coordinate={coord} title={`Parada ${index + 1}`}>
                <View style={[styles.markerBubble, { backgroundColor: colors.primary }]}>
                  <ThemedText style={styles.markerLabel}>{index + 1}</ThemedText>
                </View>
              </Marker>
            ))}
          </MapView>
        </ThemedView>

        {/* Ratings */}
        <ThemedView
          style={[
            styles.section,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <ThemedTitle style={{ marginBottom: 12 }}>Puntuación</ThemedTitle>
          <View style={styles.ratingRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontSize: 24, fontWeight: 'bold' }}>
                {route.puntuacionPromedio.toFixed(1)}
              </ThemedText>
              <ThemedTextSecondary>{route.numCalificaciones} calificaciones</ThemedTextSecondary>
            </View>

            {!isOwner && (
              <View>
                <View style={styles.ratingStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => handleRateRoute(star)}
                      onPressIn={() => setTempRating(star)}
                      onPressOut={() => setTempRating(0)}
                      disabled={ratingLoading}
                      style={{ padding: 4 }}
                    >
                      <MaterialIcons
                        name={
                          star <= (tempRating || userRating || 0)
                            ? 'star'
                            : 'star-outline'
                        }
                        size={32}
                        color={
                          star <= (tempRating || userRating || 0)
                            ? '#f39c12'
                            : colors.textSecondary
                        }
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                {userRating && !tempRating && (
                  <ThemedTextSecondary style={{ marginTop: 8, textAlign: 'right' }}>
                    Tu calificación: {userRating} ⭐
                  </ThemedTextSecondary>
                )}
              </View>
            )}
          </View>
        </ThemedView>

        {/* Eventos */}
        <ThemedView
          style={[
            styles.section,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <ThemedTitle style={{ marginBottom: 12 }}>Paradas ({route.secuenciaEventos.length})</ThemedTitle>
          <FlatList
            data={route.secuenciaEventos}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item, index }) => (
              <View key={item.id} style={styles.eventItemInRoute}>
                <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                  <ThemedText style={{ color: 'white', fontWeight: 'bold' }}>{index + 1}</ThemedText>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText numberOfLines={1} style={{ fontWeight: '600' }}>
                    {item.title}
                  </ThemedText>
                  <ThemedTextSecondary numberOfLines={1}>{item.address}</ThemedTextSecondary>
                  {item.fechaInicio && (
                    <ThemedTextSecondary style={{ fontSize: 12 }}>
                      {formatSevillaTime(item.fechaInicio)}
                    </ThemedTextSecondary>
                  )}
                </View>
              </View>
            )}
          />
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  creadorRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  section: {
    marginHorizontal: 14,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  map: {
    width: '100%',
    height: 300,
    borderRadius: 8,
  },
  markerBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  markerLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 4,
  },
  eventItemInRoute: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
