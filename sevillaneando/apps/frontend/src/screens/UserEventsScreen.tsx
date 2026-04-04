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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, getErrorMessage } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { ThemedView, ThemedText, ThemedTextSecondary, ThemedTitle } from '../components';
import type { RootStackParamList } from '../App';
import type { Event } from '../types/event';

export const UserEventsScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'UserEvents'>>();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserEvents = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/events/user/${user.id}`);
      setEvents(res.data);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchUserEvents();
    }, [fetchUserEvents])
  );

  const handleEdit = (event: Event) => {
    navigation.navigate('EditEvent', { event });
  };

  if (!user?.id) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Debes iniciar sesión para ver tus eventos.</ThemedText>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedTextSecondary style={{ marginTop: 8 }}>
          Cargando tus eventos...
        </ThemedTextSecondary>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedTitle style={styles.title}>Mis eventos</ThemedTitle>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleEdit(item)} activeOpacity={0.8}>
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
                source={item.imagen ? { uri: item.imagen } : require('../../assets/splash.png')}
                style={styles.image}
                resizeMode="cover"
              />
              <ThemedText style={styles.eventTitle}>{item.title}</ThemedText>
              <ThemedText style={styles.eventDesc} numberOfLines={2}>
                {item.description}
              </ThemedText>

              <ThemedTextSecondary style={styles.eventInfo}>
                Fecha: {item.fechaInicio ? dayjs(item.fechaInicio).format('YYYY/MM/DD HH:mm') : 'No definida'}
              </ThemedTextSecondary>

              <ThemedTextSecondary style={styles.eventInfo}>
                Ubicación: {item.address}
              </ThemedTextSecondary>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: colors.primary }]}
                  onPress={() => handleEdit(item)}
                >
                  <ThemedText style={styles.buttonText}>Editar evento</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <ThemedTextSecondary style={{ textAlign: 'center', marginTop: 40 }}>
            No has creado ningún evento aún.
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
  eventDesc: { fontSize: 15, marginBottom: 8 },
  eventInfo: { fontSize: 13, marginBottom: 2 },
  actions: { marginTop: 14 },
  button: {
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default UserEventsScreen;
