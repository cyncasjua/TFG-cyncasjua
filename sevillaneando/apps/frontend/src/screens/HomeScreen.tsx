import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  View,
  TextInput,
  Modal,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { getEvents, api, getErrorMessage } from '../services/api';
import { RootStackParamList } from '../App';
import type { Event } from '../types/event';
import { useAuth } from '../hooks/useAuth';

type EventWithDistance = Event & { distance?: number };
import {
  ThemedView,
  ThemedCard,
  ThemedText,
  ThemedTextSecondary,
  ThemedTitle,
  ThemedButton,
} from '../components';
import { useTheme } from '../hooks/useTheme';
import { ImageBackground } from 'react-native';
import { ProfileHeader } from './ProfileHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<EventWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [categories, setCategories] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterNearby, setFilterNearby] = useState(false);
  const [searchRadius, setSearchRadius] = useState(1);
  const [customRadiusVisible, setCustomRadiusVisible] = useState(false);
  const [customRadiusInput, setCustomRadiusInput] = useState('');
  const [radiusOptions, setRadiusOptions] = useState([0.5, 1, 2, 5, 10]);
  const { role, logout, user } = useAuth();
  const { colors, setTheme, theme } = useTheme();

  const persistCategoryOrder = async (order: string[]) => {
    try {
      await api.patch('/users/me/firebase', { categoryOrder: order });
    } catch (err) {
      console.error('Error guardando orden de categorías:', getErrorMessage(err));
    }
  };

  const persistRadiusOptions = async (options: number[]) => {
    try {
      await api.patch('/users/me/firebase', { radiusOptions: options });
    } catch (err) {
      console.error('Error guardando radios personalizados:', getErrorMessage(err));
    }
  };

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
  const calculateWalkingTime = (distanceKm: number): string => {
    // Velocidad promedio a pie: 1.4 m/s = 5.04 km/h
    const minutes = Math.round((distanceKm / 5.04) * 60);
    if (minutes < 1) return '< 1 min';
    return `${minutes} min`;
  };

  const calculateDrivingTime = (distanceKm: number): string => {
    // Velocidad promedio en coche en ciudad: 13.9 m/s = 50 km/h
    const minutes = Math.round((distanceKm / 50) * 60);
    if (minutes < 1) return '< 1 min';
    return `${minutes} min`;
  };

  const handleAddCustomRadius = () => {
    const value = parseFloat(customRadiusInput);
    if (value > 0 && !radiusOptions.includes(value)) {
      const newRadiusOptions = [...radiusOptions, value].sort((a, b) => a - b);
      setRadiusOptions(newRadiusOptions);
      setSearchRadius(value);
      setCustomRadiusInput('');
      setCustomRadiusVisible(false);
      persistRadiusOptions(newRadiusOptions);
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/categorias');
        let data = res.data as { id: string; nombre: string }[];
        if (user?.categoryOrder && user.categoryOrder.length > 0) {
          const orderIndex = new Map(user.categoryOrder.map((id, idx) => [id, idx]));
          data = [...data].sort((a, b) => {
            const aIdx = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
            const bIdx = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
            return aIdx - bIdx;
          });
        }
        setCategories(data);
      } catch (e) {
        setCategories([]);
      }
    };
    fetchCategories();
  }, [user?.categoryOrder]);

  useEffect(() => {
    if (user?.radiusOptions && user.radiusOptions.length > 0) {
      const uniqueSorted = Array.from(new Set(user.radiusOptions))
        .filter((value) => Number.isFinite(value) && value > 0)
        .sort((a, b) => a - b);
      if (uniqueSorted.length > 0) {
        setRadiusOptions(uniqueSorted);
        if (!uniqueSorted.includes(searchRadius)) {
          setSearchRadius(uniqueSorted[0]);
        }
      }
    }
  }, [user?.radiusOptions, searchRadius]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const remote = await getEvents();

      if (user?.ubicacion?.coordinates && user.ubicacion.coordinates.length === 2) {
        const userLon = user.ubicacion.coordinates[0];
        const userLat = user.ubicacion.coordinates[1];

        const sortedEvents = remote
          .map((event) => {
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
          })
          .sort((a, b) => a.distance - b.distance);

        setItems(sortedEvents);
      } else {
        setItems(remote);
      }
    } catch (err) {
      console.error('Error cargando eventos:', err);
      const message = getErrorMessage(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents])
  );

  const onLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedTextSecondary style={{ marginTop: 8 }}>Cargando eventos...</ThemedTextSecondary>
      </ThemedView>
    );
  }

  return (
    <ImageBackground
      source={require('../../assets/icon.png')}
      style={[styles.background, { backgroundColor: colors.background }]}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
      blurRadius={2}
    >
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            backgroundColor:
              theme === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.25)',
          },
        ]}
      />
      <ThemedView style={styles.container}>
        <ThemedView
          style={[
            styles.header,
            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
          ]}
        >
          <ThemedView>
            <ThemedTitle>Eventos en Sevilla</ThemedTitle>
            <ThemedTextSecondary style={{ marginTop: 4 }}>
              Rol actual:{' '}
              <ThemedText style={{  fontWeight: 'bold' }}>{role}</ThemedText>
            </ThemedTextSecondary>
          </ThemedView>
          {user?.ubicacion && (
            <TouchableOpacity
              style={{
                paddingVertical: 7,
                paddingHorizontal: 14,
                borderRadius: 18,
                backgroundColor: filterNearby ? '#ffd700' : colors.card,
                borderWidth: 1.5,
                borderColor: '#ffd700',
                flexDirection: 'row',
                alignItems: 'center',
              }}
              onPress={() => setFilterNearby(!filterNearby)}
            >
              <MaterialIcons
                name="near-me"
                size={15}
                color={filterNearby ? '#fff' : '#ffd700'}
                style={{ marginRight: 4 }}
              />
              <ThemedText
                style={{
                  color: filterNearby ? '#fff' : colors.text + '99',
                  fontWeight: '500',
                  fontSize: 11,
                }}
              >
                Cerca
              </ThemedText>
            </TouchableOpacity>
          )}
        </ThemedView>
        {filterNearby && user?.ubicacion && (
          <ThemedView style={{ marginBottom: 12 }}>
            <ThemedText
              style={{
                fontWeight: 'bold',
                fontSize: 13,
                marginLeft: 1,
                marginBottom: 6,
                color: colors.primary,
              }}
            >
              Mostrar hasta:
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 12 }}
            >
              {radiusOptions.map((radius) => (
                <TouchableOpacity
                  key={radius}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 16,
                    backgroundColor: searchRadius === radius ? '#ffd700' : colors.card,
                    marginRight: 6,
                    borderWidth: 1,
                    borderColor: searchRadius === radius ? '#ffd700' : colors.text + '33',
                  }}
                  onPress={() => setSearchRadius(radius)}
                >
                  <ThemedText
                    style={{
                      color: searchRadius === radius ? '#fff' : colors.text,
                      fontWeight: '500',
                      fontSize: 11,
                    }}
                  >
                    {radius === 0.5 ? '<= 500 m' : `<= ${radius} km`}
                  </ThemedText>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  backgroundColor: colors.card,
                  marginRight: 6,
                  borderWidth: 1,
                  borderColor: colors.primary + '66',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                onPress={() => setCustomRadiusVisible(true)}
              >
                <MaterialIcons name="add" size={16} color={colors.primary} />
              </TouchableOpacity>
            </ScrollView>
          </ThemedView>
        )}
        {categories.length > 0 && (
          <ThemedView style={{ marginBottom: 12 }}>
            <ThemedText
              style={{
                fontWeight: 'bold',
                fontSize: 14,
                marginLeft: 1,
                marginBottom: 8,
                color: colors.primary,
              }}
            >
              Categoría:
            </ThemedText>
            <DraggableFlatList
              horizontal
              data={categories}
              keyExtractor={(item) => item.id}
              onDragEnd={({ data }) => {
                setCategories(data);
                persistCategoryOrder(data.map((item) => item.id));
              }}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 12 }}
              ListHeaderComponent={
                <TouchableOpacity
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 16,
                    borderRadius: 18,
                    backgroundColor: selectedCategory === null ? colors.primary : colors.card,
                    marginRight: 8,
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                  }}
                  onPress={() => setSelectedCategory(null)}
                >
                  <ThemedText
                    style={{
                      color: selectedCategory === null ? '#fff' : colors.primary,
                      fontWeight: 'bold',
                      fontSize: 13,
                    }}
                  >
                    Todas
                  </ThemedText>
                </TouchableOpacity>
              }
              renderItem={({ item, drag, isActive }) => (
                <TouchableOpacity
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 16,
                    borderRadius: 18,
                    backgroundColor: selectedCategory === item.id ? colors.primary : colors.card,
                    marginRight: 8,
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                    opacity: isActive ? 0.7 : 1,
                  }}
                  onPress={() => setSelectedCategory(item.id)}
                  onLongPress={drag}
                  delayLongPress={150}
                >
                  <ThemedText
                    style={{
                      color: selectedCategory === item.id ? '#fff' : colors.primary,
                      fontWeight: 'bold',
                      fontSize: 13,
                    }}
                  >
                    {item.nombre}
                  </ThemedText>
                </TouchableOpacity>
              )}
            />
          </ThemedView>
        )}
        {!user?.ubicacion && (
          <TouchableOpacity
            onPress={() => navigation.navigate('EditProfile')}
            style={{
              backgroundColor: colors.primary + '20',
              borderLeftWidth: 3,
              borderLeftColor: colors.primary,
              padding: 12,
              marginBottom: 12,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <MaterialIcons
              name="location-on"
              size={20}
              color={colors.primary}
              style={{ marginRight: 8 }}
            />
            <ThemedText style={{ flex: 1, fontSize: 13, color: colors.primary }}>
              Configura tu ubicación para ver eventos ordenados por cercanía
            </ThemedText>
            <MaterialIcons name="arrow-forward" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
          <MaterialIcons name="menu" size={32} color="#6c2eb7" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapIconButton}
          onPress={() => navigation.navigate('EventsMap')}
          accessibilityLabel="Ver mapa"
        >
          <MaterialIcons name="map" size={32} color="#6c2eb7" />

        </TouchableOpacity>

        {role === 'user' && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('CreateEvent')}
            accessibilityLabel="Crear evento"
          >
            <MaterialIcons name="add-circle" size={56} color="#6c2eb7" />
          </TouchableOpacity>
        )}

        {role === 'moderator' && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('ModeratorEvents')}
            accessibilityLabel="Aprobar eventos"
          >
            <MaterialIcons name="check-circle" size={56} color="#4caf50" />
          </TouchableOpacity>
        )}

        {role === 'admin' && (
          <ThemedView style={styles.adminActions}>
            <TouchableOpacity
              style={styles.adminActionButton}
              onPress={() => navigation.navigate('Admin')}
            >
              <MaterialIcons name="admin-panel-settings" size={28} color="#6c2eb7" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.adminActionButton}
              onPress={() => navigation.navigate('Categories')}
            >
              <MaterialIcons name="category" size={28} color="#6c2eb7" />
            </TouchableOpacity>
          </ThemedView>
        )}

        <TouchableOpacity
          style={styles.notificationsButton}
          onPress={() => navigation.navigate('Notifications')}
          accessibilityLabel="Ver notificaciones"
        >
          <MaterialIcons name="notifications" size={35} color="#ffd700" />
        </TouchableOpacity>

        {error && <ThemedText style={{ color: colors.error, marginBottom: 8 }}>{error}</ThemedText>}
        <FlatList
          data={(() => {
            let filtered = items;

            if (selectedCategory) {
              filtered = filtered.filter((ev) => ev.categoria?.id === selectedCategory);
            }

            if (filterNearby && searchRadius) {
              filtered = filtered.filter(
                (ev) => ev.distance !== undefined && ev.distance <= searchRadius
              );
            }

            return filtered;
          })()}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          renderItem={({ item, index }) => {
            const nowMs = Date.now();
            const startMs = new Date(item.fechaInicio).getTime();
            const endMs = new Date(item.fechaFin).getTime();
            const isOngoing = Number.isFinite(startMs) && Number.isFinite(endMs)
              ? nowMs >= startMs && nowMs <= endMs
              : false;
            const isWithinWeek = Number.isFinite(startMs)
              ? startMs > nowMs && startMs - nowMs <= 7 * 24 * 60 * 60 * 1000
              : false;
            return (
              <TouchableOpacity onPress={() => navigation.navigate('EventDetail', { event: item })}>
                <ThemedCard style={{ marginBottom: 8, padding: 0, overflow: 'hidden' }}>
                  {isOngoing && (
                    <ThemedText style={[styles.statusBadge, styles.statusOngoing]}>
                      En curso
                    </ThemedText>
                  )}
                  {!isOngoing && isWithinWeek && (
                    <ThemedText style={[styles.statusBadge, styles.statusSoon]}>
                      En &lt; 7 días
                    </ThemedText>
                  )}
                  {item.distance !== undefined && item.distance !== Infinity && (
                    <ThemedText
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: colors.primary,
                        color: '#fff',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 'bold',
                        zIndex: 10,
                      }}
                    >
                      {item.distance.toFixed(1)} km
                    </ThemedText>
                  )}
                  <ImageBackground
                    source={item.imagen ? { uri: item.imagen } : require('../../assets/splash.png')}
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
                      {item.title}
                    </ThemedText>
                    <ThemedTextSecondary
                      style={{
                        fontSize: 13,
                        color: theme === 'dark' ? '#eee' : '#444',
                        marginLeft: 14,
                        marginBottom: 6,
                        flexDirection: 'row',
                        alignItems: 'center',
                        textShadowColor:
                          theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.1)',
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 2,
                      }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      <MaterialIcons name="place" size={16} color="#ffd700" /> {item.address}
                    </ThemedTextSecondary>
                  </ImageBackground>
                  <ThemedView style={{ padding: 12 }}>
                    <ThemedView
                      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
                    >
                      <MaterialIcons name="event" size={16} color="#6c2eb7" />
                      <ThemedTextSecondary style={{ marginLeft: 4 }}>
                        {new Date(item.fechaInicio).toLocaleDateString()} -{' '}
                        {new Date(item.fechaFin).toLocaleDateString()}
                      </ThemedTextSecondary>
                    </ThemedView>
                    <ThemedView
                      style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
                    >
                      <MaterialIcons name="category" size={16} color="#6c2eb7" />
                      <ThemedTextSecondary style={{ marginLeft: 4 }}>
                        {item.categoria?.nombre}
                      </ThemedTextSecondary>
                    </ThemedView>
                    {item.distance !== undefined && item.distance !== Infinity && (
                      <>
                        <ThemedView
                          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
                        >
                          <MaterialIcons name="directions-walk" size={16} color="#4caf50" />
                          <ThemedTextSecondary style={{ marginLeft: 4 }}>
                            {calculateWalkingTime(item.distance)} a pie
                          </ThemedTextSecondary>
                        </ThemedView>
                        <ThemedView
                          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}
                        >
                          <MaterialIcons name="directions-car" size={16} color="#2196F3" />
                          <ThemedTextSecondary style={{ marginLeft: 4 }}>
                            {calculateDrivingTime(item.distance)} en coche
                          </ThemedTextSecondary>
                        </ThemedView>
                      </>
                    )}
                    <ThemedView style={{ alignItems: 'flex-end', marginTop: 8 }}>
                      <ThemedText
                        style={{
                          fontSize: 18,
                          fontWeight: 'bold',
                          color: '#fff',
                          backgroundColor: '#6c2eb7',
                          paddingHorizontal: 12,
                          paddingVertical: 4,
                          borderRadius: 12,
                          overflow: 'hidden',
                          alignSelf: 'flex-end',
                        }}
                      >
                        {item.precio === 0 ? 'Gratis' : `${item.precio} €`}
                      </ThemedText>
                    </ThemedView>
                  </ThemedView>
                </ThemedCard>
              </TouchableOpacity>
            );
          }}
        />

        {menuVisible && (
          <ThemedView style={styles.menuOverlay}>
            <ThemedView style={[styles.menuContainer, { backgroundColor: colors.card }]}>
              <ThemedTitle style={styles.menuTitle}>Menú</ThemedTitle>
              <ProfileHeader
                onPress={() => {
                  setMenuVisible(false);
                  navigation.navigate('EditProfile');
                }}
              />
              <ThemedView style={styles.menuSection}>
                <ThemedTextSecondary style={{ marginBottom: 8 }}>Tema:</ThemedTextSecondary>
                <ThemedView style={styles.themeRow}>
                  <ThemedButton
                    title="Claro"
                    variant={theme === 'light' ? 'primary' : 'secondary'}
                    onPress={() => setTheme('light')}
                    style={styles.menuButtonOption}
                  />
                  <ThemedButton
                    title="Oscuro"
                    variant={theme === 'dark' ? 'primary' : 'secondary'}
                    onPress={() => setTheme('dark')}
                    style={styles.menuButtonOption}
                  />
                </ThemedView>
              </ThemedView>
              <ThemedButton
                title="Cerrar sesión"
                variant="danger"
                onPress={onLogout}
                style={styles.menuButtonOption}
              />
              <TouchableOpacity
                style={styles.closeMenuButton}
                onPress={() => setMenuVisible(false)}
                accessibilityLabel="Cerrar menú"
              >
                <MaterialIcons name="close" size={32} color="#6c2eb7" />
              </TouchableOpacity>
            </ThemedView>
          </ThemedView>
        )}

        <Modal
          visible={customRadiusVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setCustomRadiusVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <ThemedView style={[styles.modalContainer, { backgroundColor: colors.card }]}>
              <ThemedTitle style={styles.modalTitle}>Radio personalizado</ThemedTitle>
              <ThemedText style={{ marginBottom: 12, color: colors.text }}>
                Ingresa el radio en kilómetros
              </ThemedText>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.primary,
                  },
                ]}
                placeholder="Ej: 3, 7.5, 15"
                placeholderTextColor={colors.text + '66'}
                value={customRadiusInput}
                onChangeText={setCustomRadiusInput}
                keyboardType="decimal-pad"
              />
              <View style={styles.modalButtonsContainer}>
                <ThemedButton
                  title="Cancelar"
                  variant="secondary"
                  onPress={() => {
                    setCustomRadiusVisible(false);
                    setCustomRadiusInput('');
                  }}
                  style={{ flex: 1 }}
                />
                <ThemedButton
                  title="Añadir"
                  variant="primary"
                  onPress={handleAddCustomRadius}
                  style={{ flex: 1, marginLeft: 8 }}
                />
              </View>
            </ThemedView>
          </View>
        </Modal>
      </ThemedView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  logo: { width: 32, height: 32, marginRight: 8 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  headerTitleText: { fontSize: 22, fontWeight: 'bold' },
  background: { flex: 1 },
  backgroundImage: { opacity: 0.2, transform: [{ scale: 1.5 }, { translateY: 40 }] },
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    marginTop: 60,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  menuButton: {
    position: 'absolute',
    top: 18,
    left: 18,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 8,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'trasparent',
    zIndex: 100,
    flexDirection: 'row',
  },
  menuContainer: {
    width: '80%',
    height: '100%',
    padding: 24,
    borderTopRightRadius: 40,
    borderBottomRightRadius: 40,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 2, height: 0 },
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  menuTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 18 },
  menuSection: { marginBottom: 24 },
  menuButtonOption: {
    marginBottom: 0,
    alignSelf: 'stretch',
  },
  headerButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  smallButton: { paddingHorizontal: 14, paddingVertical: 8 },
  smallButtonText: { fontSize: 12 },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  tinyButton: { paddingHorizontal: 10, paddingVertical: 6 },
  tinyButtonText: { fontSize: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  separator: { height: 12 },
  closeMenuButton: {
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 4,
  },
  adminActions: {
    position: 'absolute',
    top: 18,
    left: 72,
    zIndex: 10,
    flexDirection: 'row',
    gap: 8,
  },
  adminActionButton: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 8,
  },
  mapIconButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 11,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 32,
    zIndex: 20,
    elevation: 8,
    backgroundColor: 'transparent',
  },
  fabLeft: {
    position: 'absolute',
    bottom: 32,
    left: 32,
    zIndex: 20,
    elevation: 8,
    backgroundColor: 'transparent',
  },
  notificationsButton: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    zIndex: 11,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    marginBottom: 12,
    fontSize: 18,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 16,
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
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
});
