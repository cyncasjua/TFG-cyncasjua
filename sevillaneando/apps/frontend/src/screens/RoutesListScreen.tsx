import React, { useCallback, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  View,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import localeEs from 'dayjs/locale/es.js';

dayjs.extend(utc);
dayjs.locale(localeEs);
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getRoutes, getErrorMessage, type UserRoute } from '../services';
import { useTheme } from '../hooks/useTheme';
import {
  ThemedView,
  ThemedText,
  ThemedTextSecondary,
  ThemedTitle,
  ThemedButton,
} from '../components';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { RootStackParamList } from '../navigation/types';
import { reportError } from '../utils/telemetry';

export const RoutesListScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [routes, setRoutes] = useState<UserRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const allRoutes = await getRoutes();
      setRoutes(allRoutes);
    } catch (err) {
      reportError('routes-list.fetch', getErrorMessage(err), err);
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRoutes();
    }, [fetchRoutes])
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Rutas',
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

  const filteredRoutes = routes.filter(
    (route) =>
      route.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.descripcion?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRoutePress = (route: UserRoute) => {
    navigation.navigate('RouteDetail', { routeId: route.id });
  };

  const handleCreateRoute = () => {
    navigation.navigate('CreateRoute');
  };

  if (loading && routes.length === 0) {
    return (
      <ThemedView style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedTextSecondary style={{ marginTop: 8 }}>Cargando rutas...</ThemedTextSecondary>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <MaterialIcons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Buscar rutas..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialIcons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <ThemedButton
        onPress={handleCreateRoute}
        icon={<MaterialIcons name="add" size={18} color="white" />}
        style={styles.createButton}
      >
        Nueva ruta
      </ThemedButton>

      {/* Routes List */}
      {filteredRoutes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="directions" size={48} color={colors.textSecondary} />
          <ThemedTextSecondary style={{ marginTop: 12, textAlign: 'center' }}>
            {routes.length === 0
              ? 'No hay rutas disponibles.\n¡Crea la primera!'
              : 'No se encontraron rutas que coincidan con tu búsqueda.'}
          </ThemedTextSecondary>
        </View>
      ) : (
        <FlatList
          data={filteredRoutes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleRoutePress(item)}
              style={styles.routeCard}
            >
              <ThemedView
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.routeTitle} numberOfLines={1}>
                      {item.titulo}
                    </ThemedText>
                    <ThemedTextSecondary numberOfLines={1}>
                      Por {item.creador.nombre}
                    </ThemedTextSecondary>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
                </View>

                {/* Description */}
                {item.descripcion && (
                  <ThemedTextSecondary style={styles.description} numberOfLines={2}>
                    {item.descripcion}
                  </ThemedTextSecondary>
                )}

                {/* Info Row */}
                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <MaterialIcons name="location-on" size={14} color={colors.primary} />
                    <ThemedTextSecondary>
                      {item.secuenciaEventos.length} paradas
                    </ThemedTextSecondary>
                  </View>

                  <View style={styles.infoItem}>
                    <MaterialIcons name="schedule" size={14} color={colors.primary} />
                    <ThemedTextSecondary>{item.temporizacion} min</ThemedTextSecondary>
                  </View>

                  {item.numCalificaciones > 0 && (
                    <View style={styles.infoItem}>
                      <MaterialIcons name="star" size={14} color="#f39c12" />
                      <ThemedTextSecondary>
                        {item.puntuacionPromedio.toFixed(1)} ({item.numCalificaciones})
                      </ThemedTextSecondary>
                    </View>
                  )}

                  <ThemedTextSecondary style={{ marginLeft: 'auto', fontSize: 12 }}>
                    {dayjs(item.fechaCreacion).locale('es').format('DD MMM')}
                  </ThemedTextSecondary>
                </View>
              </ThemedView>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.flatListContent}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="directions" size={48} color={colors.textSecondary} />
              <ThemedTextSecondary style={{ marginTop: 12 }}>
                No hay rutas disponibles
              </ThemedTextSecondary>
            </View>
          }
        />
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    height: 44,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  createButton: {
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  routeCard: {
    marginVertical: 6,
  },
  card: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeTitle: {
    fontWeight: '600',
    fontSize: 15,
  },
  description: {
    marginBottom: 8,
    fontSize: 13,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  flatListContent: {
    paddingBottom: 20,
  },
});
