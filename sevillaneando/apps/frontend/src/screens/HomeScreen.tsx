import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase/config';
import { getEvents, setAuthToken } from '../services/api';
import { events as fallbackEvents } from '../seed/events';
import { RootStackParamList } from '../App';
import type { Event } from '../types/event';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
        const token = await auth.currentUser?.getIdToken();
        if (token) setAuthToken(token);
        const remote = await getEvents();
        setItems(remote);
      } catch (err) {
        console.error('No se pudieron cargar eventos remotos', err);
        setError('Mostrando eventos de ejemplo (sin conexión con backend).');
        setItems(fallbackEvents);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Cargando eventos...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Eventos en Sevilla</Text>
      {error && <Text style={styles.warning}>{error}</Text>}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('EventDetail', { event: item })}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.address}</Text>
            <Text style={styles.cardDescription} numberOfLines={2}>
              {item.description}
            </Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text>No hay eventos disponibles.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f7f7f7' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { marginTop: 8, color: '#444' },
  warning: { color: '#b45309', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: '#111' },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4, color: '#1a1a1a' },
  cardSubtitle: { fontSize: 14, color: '#444', marginBottom: 6 },
  cardDescription: { fontSize: 13, color: '#555' },
  separator: { height: 12 }
});
