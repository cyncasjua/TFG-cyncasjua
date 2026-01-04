import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getEvents } from '../services/api';
import { events as fallbackEvents } from '../seed/events';
import { RootStackParamList } from '../App';
import type { Event } from '../types/event';
import { useAuth } from '../hooks/useAuth';
import { ThemedView, ThemedCard, ThemedText, ThemedTextSecondary, ThemedTitle, ThemedButton } from '../components';
import { useTheme } from '../hooks/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { role, logout } = useAuth();
  const { colors, setTheme, theme } = useTheme();

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError(null);
      try {
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
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedView>
          <ThemedTitle>Eventos en Sevilla</ThemedTitle>
          <ThemedTextSecondary style={{ marginTop: 4 }}>Rol actual: {role}</ThemedTextSecondary>
        </ThemedView>
        <ThemedView style={styles.headerButtons}>
          {role === 'admin' && (
            <ThemedButton 
              title="Admin" 
              variant="primary"
              onPress={() => navigation.navigate('Admin')}
              style={styles.smallButton}
              textStyle={styles.smallButtonText}
            />
          )}
          <ThemedButton 
            title="Cerrar sesión" 
            variant="danger"
            onPress={onLogout}
            style={styles.smallButton}
            textStyle={styles.smallButtonText}
          />
        </ThemedView>
      </ThemedView>
      <ThemedView style={styles.themeRow}>
        <ThemedTextSecondary style={{ marginRight: 8 }}>Tema:</ThemedTextSecondary>
        <ThemedButton
          title="Claro"
          variant={theme === 'light' ? 'primary' : 'secondary'}
          onPress={() => setTheme('light')}
          style={styles.tinyButton}
          textStyle={styles.tinyButtonText}
        />
        <ThemedButton
          title="Oscuro"
          variant={theme === 'dark' ? 'primary' : 'secondary'}
          onPress={() => setTheme('dark')}
          style={styles.tinyButton}
          textStyle={styles.tinyButtonText}
        />
      </ThemedView>
      {error && <ThemedText style={{ color: colors.error, marginBottom: 8 }}>{error}</ThemedText>}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('EventDetail', { event: item })}>
            <ThemedCard>
              <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
              <ThemedTextSecondary style={{ marginBottom: 6 }}>{item.address}</ThemedTextSecondary>
              <ThemedTextSecondary numberOfLines={2}>
                {item.description}
              </ThemedTextSecondary>
            </ThemedCard>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <ThemedView style={styles.separator} />}
        ListEmptyComponent={<ThemedText>No hay eventos disponibles.</ThemedText>}
      />
    </ThemedView>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  headerButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  smallButton: { paddingHorizontal: 14, paddingVertical: 8 },
  smallButtonText: { fontSize: 12 },
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  tinyButton: { paddingHorizontal: 10, paddingVertical: 6 },
  tinyButtonText: { fontSize: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  separator: { height: 12 }
});
