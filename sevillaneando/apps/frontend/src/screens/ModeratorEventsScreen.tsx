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
import dayjs from 'dayjs';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, getErrorMessage } from '../services/api';
import { formatEventDateRange } from '../utils/sevillaTime';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { ThemedView, ThemedText, ThemedTextSecondary, ThemedTitle } from '../components';
import { getFullImageUrl } from '../utils/imageUrl';
import type { RootStackParamList } from '../App';
import type { Event } from '../types/event';

type Props = NativeStackScreenProps<RootStackParamList, 'ModeratorEvents'>;

export const ModeratorEventsScreen: React.FC<Props> = ({ navigation }) => {
  const { role } = useAuth();
  const { colors, theme } = useTheme();

  const [pendingEvents, setPendingEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/events/moderacion/list');
      setPendingEvents(res.data);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (role === 'moderator') fetchPendingEvents();
    }, [role, fetchPendingEvents])
  );

  const handleAprobar = async (id: string) => {
    try {
      await api.patch(`/events/${id}/aprobar`);
      Alert.alert('Evento aprobado');
      fetchPendingEvents();
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    }
  };

  const handleRechazar = async (id: string) => {
    try {
      await api.patch(`/events/${id}/rechazar`);
      Alert.alert('Evento rechazado');
      fetchPendingEvents();
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
          Cargando eventos pendientes...
        </ThemedTextSecondary>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedTitle style={styles.title}>Eventos pendientes de aprobación</ThemedTitle>
      <FlatList
        data={pendingEvents}
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
                source={getFullImageUrl(item.imagen) ? { uri: getFullImageUrl(item.imagen)! } : require('../../assets/splash.png')}
                style={styles.image}
                resizeMode="cover"
              />
              <ThemedText style={styles.eventTitle}>{item.title}</ThemedText>
              <ThemedText style={styles.eventDesc}>{item.description}</ThemedText>
              <ThemedTextSecondary style={styles.eventInfo}>
                Fecha: {formatEventDateRange(item.fechaInicio, item.fechaFin)}
              </ThemedTextSecondary>
              <ThemedTextSecondary style={styles.eventInfo}>
                Ubicación: {item.address}
              </ThemedTextSecondary>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.aprobarBtn]}
                  onPress={() => handleAprobar(item.id)}
                >
                  <ThemedText style={styles.buttonText}>Aprobar</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.rechazarBtn]}
                  onPress={() => handleRechazar(item.id)}
                >
                  <ThemedText style={styles.buttonText}>Rechazar</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <ThemedTextSecondary style={{ textAlign: 'center', marginTop: 40 }}>
            No hay eventos pendientes.
          </ThemedTextSecondary>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
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
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  aprobarBtn: {
    backgroundColor: '#4caf50',
  },
  rechazarBtn: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
