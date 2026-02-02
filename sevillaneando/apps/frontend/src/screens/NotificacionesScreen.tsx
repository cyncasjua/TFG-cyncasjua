import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, getErrorMessage } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { ThemedView, ThemedText, ThemedTextSecondary, ThemedTitle } from '../components';
import type { RootStackParamList } from '../App';

type Notificacion = {
  id: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export const NotificacionesScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotificaciones = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.get(`/notificaciones/usuario/${user.id}`);
      setNotificaciones(res.data);
    } catch (err) {
      console.error('Error cargando notificaciones:', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchNotificaciones();
    }, [fetchNotificaciones])
  );

  const marcarLeida = async (id: string) => {
    await api.patch(`/notificaciones/${id}/leida`);
    fetchNotificaciones();
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedTextSecondary style={{ marginTop: 8 }}>
          Cargando notificaciones...
        </ThemedTextSecondary>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedTitle style={styles.title}>Notificaciones</ThemedTitle>
      <FlatList
        data={notificaciones}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => marcarLeida(item.id)}>
            <ThemedView
              style={[
                styles.card,
                { backgroundColor: theme === 'dark' ? '#222' : '#f9f9f9' },
                !item.leida && { borderColor: colors.primary, borderWidth: 2 },
              ]}
            >
              <ThemedText style={styles.mensaje}>{item.mensaje}</ThemedText>
              <ThemedTextSecondary style={styles.fecha}>
                {new Date(item.fecha).toLocaleString()}
              </ThemedTextSecondary>
              {!item.leida && (
                <ThemedText style={[styles.badge, { backgroundColor: colors.primary }]}>
                  Nueva
                </ThemedText>
              )}
            </ThemedView>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<ThemedTextSecondary>No tienes notificaciones.</ThemedTextSecondary>}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  card: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  mensaje: { fontSize: 16 },
  fecha: { fontSize: 12, marginTop: 4 },
  badge: {
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    marginTop: 6,
    overflow: 'hidden',
    fontWeight: 'bold',
    fontSize: 12,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
