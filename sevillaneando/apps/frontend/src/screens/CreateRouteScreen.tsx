import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ScrollView,
  Keyboard,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  ThemedView,
  ThemedText,
  ThemedTextSecondary,
  ThemedTitle,
  ThemedButton,
} from '../components';
import { useTheme } from '../hooks/useTheme';
import { api, getErrorMessage, getEvents, createRoute, type UserRoute } from '../services';
import { useAuth } from '../hooks/useAuth';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { reportError } from '../utils/telemetry';
import { OSM_TILE_URL_TEMPLATE, SEVILLE_COORDINATES } from '../utils/map';

// Desplaza ligeramente los marcadores que comparten coordenadas exactas para que sean visibles
function offsetDuplicateCoordinates(
  coords: Array<{ latitude: number; longitude: number }>
): Array<{ latitude: number; longitude: number }> {
  const OFFSET = 0.0002;
  const seen = new Map<string, number>();
  return coords.map((coord) => {
    const key = `${coord.latitude},${coord.longitude}`;
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count === 0) return coord;
    const angle = (count * 2 * Math.PI) / 6;
    return {
      latitude: coord.latitude + OFFSET * Math.cos(angle),
      longitude: coord.longitude + OFFSET * Math.sin(angle),
    };
  });
}

type Props = NativeStackScreenProps<RootStackParamList, 'CreateRoute'>;

export const CreateRouteScreen: React.FC<Props> = ({ navigation }) => {
  const mapRef = useRef<any>(null);
  const { colors } = useTheme();
  const { user } = useAuth();

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventos, setEventos] = useState<any[]>([]);
  const [selectedEventosIds, setSelectedEventosIds] = useState<string[]>([]);
  const [temporizacion, setTemporizacion] = useState('60');

  // Ruta
  const [routeCoordinates, setRouteCoordinates] = useState<
    Array<{ latitude: number; longitude: number }>
  >([]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Crear ruta',
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontWeight: 'bold',
        fontSize: 18,
      },
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingHorizontal: 8 }}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
      ),
      headerRight: () => null,
    });
  }, [navigation, colors.primary]);

  useEffect(() => {
    const fetchEventos = async () => {
      try {
        const { events: allEventos } = await getEvents();
        setEventos(allEventos);
      } catch (error) {
        Alert.alert('Error', getErrorMessage(error));
      } finally {
        setEventsLoading(false);
      }
    };
    fetchEventos();
  }, []);

  const toggleEventSelection = useCallback((eventId: string) => {
    setSelectedEventosIds((prev) => {
      if (prev.includes(eventId)) {
        return prev.filter((id) => id !== eventId);
      } else {
        return [...prev, eventId];
      }
    });
  }, []);

  const moveEventUp = useCallback((index: number) => {
    if (index > 0) {
      setSelectedEventosIds((prev) => {
        const updated = [...prev];
        [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
        return updated;
      });
    }
  }, []);

  const moveEventDown = useCallback((index: number) => {
    setSelectedEventosIds((prev) => {
      if (index < prev.length - 1) {
        const updated = [...prev];
        [updated[index + 1], updated[index]] = [updated[index], updated[index + 1]];
        return updated;
      }
      return prev;
    });
  }, []);

  // Generar coordenadas automáticamente desde los eventos seleccionados en el orden especificado
  useEffect(() => {
    const raw = selectedEventosIds
      .map((eventId) => eventos.find((e) => e.id === eventId))
      .filter((e) => e && e.location?.coordinates?.length === 2)
      .map((e) => ({
        latitude: e.location.coordinates[1],
        longitude: e.location.coordinates[0],
      }));
    setRouteCoordinates(offsetDuplicateCoordinates(raw));
  }, [selectedEventosIds, eventos]);

  const handleCreateRoute = async () => {
    if (!titulo.trim()) {
      Alert.alert('Error', 'El título de la ruta es obligatorio');
      return;
    }

    if (selectedEventosIds.length === 0) {
      Alert.alert('Error', 'Debes seleccionar al menos un evento');
      return;
    }

    if (routeCoordinates.length === 0) {
      Alert.alert('Error', 'Los eventos seleccionados deben tener ubicaciones válidas');
      return;
    }

    if (!temporizacion || parseInt(temporizacion) <= 0) {
      Alert.alert('Error', 'La temporización debe ser un número positivo');
      return;
    }

    setLoading(true);
    try {
      const trayecto = routeCoordinates.map((coord) => ({
        type: 'Point' as const,
        coordinates: [coord.longitude, coord.latitude] as [number, number],
      }));

      const route = await createRoute({
        titulo,
        descripcion,
        trayecto,
        eventosIds: selectedEventosIds,
        temporizacion: parseInt(temporizacion),
      });

      Alert.alert('Éxito', 'Ruta creada correctamente', [
        {
          text: 'Ver ruta',
          onPress: () => {
            navigation.replace('RouteDetail', { routeId: route.id });
          },
        },
        {
          text: 'Volver',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      reportError('create-route.failed', getErrorMessage(error), error);
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Nombre Ruta */}
          <ThemedView
            style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <ThemedText style={styles.label}>Título de la ruta</ThemedText>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Ej: Mi viaje por el centro"
              placeholderTextColor={colors.textSecondary}
              value={titulo}
              onChangeText={setTitulo}
              maxLength={150}
            />
          </ThemedView>

          {/* Descripción */}
          <ThemedView
            style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <ThemedText style={styles.label}>Descripción</ThemedText>
            <TextInput
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.border, minHeight: 80 },
              ]}
              placeholder="Describe brevemente tu ruta..."
              placeholderTextColor={colors.textSecondary}
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
              maxLength={500}
            />
          </ThemedView>

          {/* Mapa para mostrar las ubicaciones de los eventos */}
          <ThemedView style={[styles.section, { backgroundColor: colors.card }]}>
            <ThemedText style={styles.label}>Ubicaciones de los eventos seleccionados</ThemedText>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: SEVILLE_COORDINATES.latitude,
                longitude: SEVILLE_COORDINATES.longitude,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              }}
              scrollEnabled={true}
              zoomEnabled={true}
            >
              <UrlTile urlTemplate={OSM_TILE_URL_TEMPLATE} maximumZ={19} />
              {routeCoordinates.map((coord, index) => (
                <Marker key={index} coordinate={coord} title={`Evento ${index + 1}`}>
                  <View style={[styles.markerBubble, { backgroundColor: colors.primary }]}>
                    <ThemedText style={styles.markerLabel}>{index + 1}</ThemedText>
                  </View>
                </Marker>
              ))}

              {routeCoordinates.length >= 2 && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor={colors.primary}
                  strokeWidth={3}
                  lineDashPattern={[1]}
                />
              )}
            </MapView>

            {routeCoordinates.length > 0 ? (
              <ThemedTextSecondary style={{ marginTop: 8 }}>
                {routeCoordinates.length} ubicaciónes de eventos en la ruta
              </ThemedTextSecondary>
            ) : (
              <ThemedTextSecondary style={{ marginTop: 8 }}>
                Selecciona eventos para ver sus ubicaciones en el mapa
              </ThemedTextSecondary>
            )}
          </ThemedView>

          {/* Temporización */}
          <ThemedView
            style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <ThemedText style={styles.label}>Duración estimada (minutos)</ThemedText>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="60"
              placeholderTextColor={colors.textSecondary}
              value={temporizacion}
              onChangeText={setTemporizacion}
              keyboardType="number-pad"
            />
          </ThemedView>

          {/* Seleccionar Eventos */}
          <ThemedView style={[styles.section, { backgroundColor: colors.card }]}>
            <ThemedText style={styles.label}>Selecciona eventos para la ruta</ThemedText>

            {selectedEventosIds.length > 0 && (
              <>
                <ThemedText style={{ fontWeight: '600', marginBottom: 8, marginTop: 12 }}>
                  Orden de visita ({selectedEventosIds.length} eventos)
                </ThemedText>
                <ScrollView style={styles.eventsList} nestedScrollEnabled>
                  {selectedEventosIds.map((eventId, index) => {
                    const evento = eventos.find((e) => e.id === eventId);
                    return (
                      <View
                        key={eventId}
                        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
                      >
                        <View style={{ flex: 1 }}>
                          <TouchableOpacity
                            style={[
                              styles.eventItem,
                              {
                                backgroundColor: colors.primary + '20',
                                borderColor: colors.primary,
                              },
                            ]}
                            onPress={() => toggleEventSelection(eventId)}
                          >
                            <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <ThemedText numberOfLines={1} style={{ fontWeight: '600' }}>
                                {index + 1}. {evento?.title}
                              </ThemedText>
                              <ThemedTextSecondary numberOfLines={1}>
                                {evento?.address}
                              </ThemedTextSecondary>
                            </View>
                          </TouchableOpacity>
                        </View>
                        <View style={{ marginLeft: 8, gap: 4 }}>
                          <TouchableOpacity
                            onPress={() => moveEventUp(index)}
                            disabled={index === 0}
                            style={{
                              padding: 8,
                              opacity: index === 0 ? 0.3 : 1,
                            }}
                          >
                            <MaterialIcons name="arrow-upward" size={20} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => moveEventDown(index)}
                            disabled={index === selectedEventosIds.length - 1}
                            style={{
                              padding: 8,
                              opacity: index === selectedEventosIds.length - 1 ? 0.3 : 1,
                            }}
                          >
                            <MaterialIcons name="arrow-downward" size={20} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            )}

            <ThemedText style={{ fontWeight: '600', marginBottom: 8, marginTop: 12 }}>
              Eventos disponibles
            </ThemedText>

            {eventsLoading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : eventos.length === 0 ? (
              <ThemedTextSecondary>No hay eventos disponibles</ThemedTextSecondary>
            ) : (
              <ScrollView style={styles.eventsList} nestedScrollEnabled>
                {eventos.map((evento) => (
                  <TouchableOpacity
                    key={evento.id}
                    style={[
                      styles.eventItem,
                      {
                        backgroundColor: selectedEventosIds.includes(evento.id)
                          ? colors.primary + '20'
                          : colors.background,
                        borderColor: selectedEventosIds.includes(evento.id)
                          ? colors.primary
                          : colors.border,
                      },
                    ]}
                    onPress={() => toggleEventSelection(evento.id)}
                  >
                    <MaterialIcons
                      name={
                        selectedEventosIds.includes(evento.id)
                          ? 'check-circle'
                          : 'radio-button-unchecked'
                      }
                      size={20}
                      color={
                        selectedEventosIds.includes(evento.id)
                          ? colors.primary
                          : colors.textSecondary
                      }
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <ThemedText numberOfLines={1}>{evento.title}</ThemedText>
                      <ThemedTextSecondary numberOfLines={1}>{evento.address}</ThemedTextSecondary>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </ThemedView>
        </ScrollView>

        {/* Botón Crear */}
        <ThemedView
          style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}
        >
          <ThemedButton
            onPress={handleCreateRoute}
            disabled={loading}
            icon={
              loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <MaterialIcons name="check" size={18} color="white" />
              )
            }
          >
            {loading ? 'Creando ruta...' : 'Crear ruta'}
          </ThemedButton>
        </ThemedView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginHorizontal: 14,
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  label: {
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  map: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    marginVertical: 8,
  },
  mapButtonsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  markerBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  eventsList: {
    maxHeight: 300,
    marginVertical: 8,
  },
  eventItem: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});
