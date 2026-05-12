import React, { useCallback, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  View,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, getErrorMessage } from '../services';
import { formatEventDateRange } from '../utils/sevillaTime';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { ThemedView, ThemedText, ThemedTextSecondary, ThemedTitle } from '../components';
import { getFullImageUrl } from '../utils/imageUrl';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { RootStackParamList } from '../navigation/types';
import type { Event } from '../types/event';

type Props = NativeStackScreenProps<RootStackParamList, 'ModeratorEvents'>;

export const ModeratorEventsScreen: React.FC<Props> = ({ navigation }) => {
  const { role } = useAuth();
  const { colors, theme } = useTheme();

  const [pendingEvents, setPendingEvents] = useState<Event[]>([]);
  const [publicEvents, setPublicEvents] = useState<Event[]>([]);
  const [activeList, setActiveList] = useState<'pending' | 'public'>('pending');
  const [loading, setLoading] = useState(true);

  const fetchModeratorEvents = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, publicRes] = await Promise.all([
        api.get('/events/moderacion/list'),
        api.get('/events/moderacion/publicos'),
      ]);
      setPendingEvents(pendingRes.data);
      setPublicEvents(publicRes.data);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (role === 'moderator') fetchModeratorEvents();
    }, [role, fetchModeratorEvents])
  );

  const handleAprobar = async (id: string) => {
    try {
      await api.patch(`/events/${id}/aprobar`);
      Alert.alert('Evento aprobado');
      fetchModeratorEvents();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    }
  };

  const handleRechazar = async (id: string) => {
    try {
      await api.patch(`/events/${id}/rechazar`);
      Alert.alert('Evento rechazado');
      fetchModeratorEvents();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    }
  };

  if (role !== 'moderator') {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>No tienes permisos para ver esta pantalla.</ThemedText>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedTextSecondary style={{ marginTop: 8 }}>
          Cargando eventos de moderación…
        </ThemedTextSecondary>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedTitle style={styles.screenTitle}>Moderación de eventos</ThemedTitle>
      <View style={[styles.tabs, { borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeList === 'pending' && styles.tabPending]}
          onPress={() => setActiveList('pending')}
        >
          <Icon
            name="clock-alert-outline"
            size={18}
            color={activeList === 'pending' ? '#fff' : '#e67e22'}
          />
          <View>
            <ThemedText style={[styles.tabText, activeList === 'pending' && styles.activeTabText]}>
              Pendientes
            </ThemedText>
            {pendingEvents.length > 0 && (
              <ThemedText
                style={[styles.tabCount, activeList === 'pending' && styles.activeTabText]}
              >
                {pendingEvents.length} evento{pendingEvents.length !== 1 ? 's' : ''}
              </ThemedText>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeList === 'public' && styles.tabPublic]}
          onPress={() => setActiveList('public')}
        >
          <Icon name="earth" size={18} color={activeList === 'public' ? '#fff' : colors.primary} />
          <View>
            <ThemedText style={[styles.tabText, activeList === 'public' && styles.activeTabText]}>
              Públicos
            </ThemedText>
            {publicEvents.length > 0 && (
              <ThemedText
                style={[styles.tabCount, activeList === 'public' && styles.activeTabText]}
              >
                {publicEvents.length} evento{publicEvents.length !== 1 ? 's' : ''}
              </ThemedText>
            )}
          </View>
        </TouchableOpacity>
      </View>
      <FlatList
        data={activeList === 'pending' ? pendingEvents : publicEvents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('ModeratorEditEvent', { event: item })}
          >
            <ThemedView
              style={[
                styles.card,
                {
                  backgroundColor: theme === 'dark' ? '#222' : '#fff',
                  borderColor: theme === 'dark' ? colors.primary : '#eee',
                  shadowColor: theme === 'dark' ? '#000' : '#aaa',
                },
              ]}
            >
              <Image
                source={
                  getFullImageUrl(item.imagen)
                    ? { uri: getFullImageUrl(item.imagen)! }
                    : require('../../assets/splash.png')
                }
                style={styles.image}
                resizeMode="cover"
              />
              <ThemedText style={styles.eventTitle}>{item.title}</ThemedText>
              <ThemedText style={styles.eventDesc} numberOfLines={2}>
                {item.description}
              </ThemedText>
              <ThemedTextSecondary style={styles.eventInfo}>
                <Icon name="calendar-outline" size={13} />{' '}
                {formatEventDateRange(item.fechaInicio, item.fechaFin)}
              </ThemedTextSecondary>
              <ThemedTextSecondary style={styles.eventInfo}>
                <Icon name="map-marker-outline" size={13} /> {item.address}
              </ThemedTextSecondary>
              {activeList === 'pending' ? (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.iconButton, styles.aprobarBtn]}
                    onPress={() => handleAprobar(item.id)}
                  >
                    <Icon name="check" size={22} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconButton, styles.rechazarBtn]}
                    onPress={() => handleRechazar(item.id)}
                  >
                    <Icon name="close" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.editButton, { backgroundColor: colors.primary }]}
                    onPress={() => navigation.navigate('ModeratorEditEvent', { event: item })}
                  >
                    <Icon name="pencil" size={18} color="#fff" />
                    <ThemedText style={styles.editButtonText}>Editar</ThemedText>
                  </TouchableOpacity>
                </View>
              )}
            </ThemedView>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon
              name={activeList === 'pending' ? 'clock-check-outline' : 'earth-off'}
              size={48}
              color={colors.text + '44'}
            />
            <ThemedTextSecondary style={styles.emptyText}>
              {activeList === 'pending'
                ? 'No hay eventos pendientes de revisión.'
                : 'No hay eventos públicos editables.'}
            </ThemedTextSecondary>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  screenTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  tabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  tabPending: { backgroundColor: '#e67e22' },
  tabPublic: { backgroundColor: '#7c4dff' },
  tabText: { fontWeight: 'bold', fontSize: 14 },
  tabCount: { fontSize: 11, opacity: 0.85, textAlign: 'center' },
  activeTabText: { color: '#fff' },
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: '#ccc',
  },
  eventTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 6 },
  eventDesc: { fontSize: 15, marginBottom: 6 },
  eventInfo: { fontSize: 13, marginBottom: 2 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
    gap: 10,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 6,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  aprobarBtn: {
    backgroundColor: '#4caf50',
  },
  rechazarBtn: {
    backgroundColor: '#f44336',
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { textAlign: 'center', fontSize: 15, opacity: 0.6 },
});
