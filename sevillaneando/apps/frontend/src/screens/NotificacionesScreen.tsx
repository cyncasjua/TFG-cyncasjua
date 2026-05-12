import React, { useCallback, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, getErrorMessage } from '../services';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useNotificaciones } from '../context/NotificacionesContext';
import { ThemedView, ThemedText, ThemedTextSecondary, ThemedTitle } from '../components';
import type { RootStackParamList } from '../navigation/types';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { reportError } from '../utils/telemetry';
import { formatSevillaDateTime } from '../utils/sevillaTime';

type Notificacion = {
  id: string;
  mensaje: string;
  tipo: string;
  fecha: string;
  leida: boolean;
  targetUserId?: string | null;
  targetEventId?: string | null;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export const NotificacionesScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  const { refresh } = useNotificaciones();
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  const fetchNotificaciones = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.get(`/notificaciones/usuario/${user.id}`);
      setNotificaciones(res.data);
    } catch (err) {
      reportError(
        'notifications.fetch',
        `Error cargando notificaciones: ${getErrorMessage(err)}`,
        err
      );
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
    await Promise.all([fetchNotificaciones(), refresh()]);
  };

  const abrirDestino = async (item: Notificacion) => {
    if (!item.leida) {
      await api.patch(`/notificaciones/${item.id}/leida`);
      await refresh();
    }

    if (item.targetUserId) {
      navigation.navigate('UserProfile', { userId: item.targetUserId });
      return;
    }

    if (item.targetEventId) {
      navigation.navigate('EventDetailLink', { eventId: item.targetEventId });
    }
  };

  const getActionLabel = (item: Notificacion) => {
    if (item.targetUserId) return 'Ver perfil';
    if (item.targetEventId) return 'Ver evento';
    return null;
  };

  const marcarTodasLeidas = async () => {
    setMarcandoTodas(true);
    try {
      const noLeidas = notificaciones.filter((n) => !n.leida);
      await Promise.all(noLeidas.map((n) => api.patch(`/notificaciones/${n.id}/leida`)));
      await Promise.all([fetchNotificaciones(), refresh()]);
    } catch (err) {
      reportError(
        'notifications.mark-all',
        `Error marcando todas como leídas: ${getErrorMessage(err)}`,
        err
      );
      Alert.alert('Error', 'No se pudieron marcar todas las notificaciones como leídas');
    } finally {
      setMarcandoTodas(false);
    }
  };

  const borrarNotificacion = async (id: string) => {
    try {
      await api.delete(`/notificaciones/${id}`);
      setNotificaciones((prev) => prev.filter((n) => n.id !== id));
      await refresh();
    } catch (err) {
      reportError(
        'notifications.delete',
        `Error borrando notificación: ${getErrorMessage(err)}`,
        err
      );
    }
  };

  const confirmarBorrado = (id: string) => {
    Alert.alert('Eliminar', '¿Estás seguro de que quieres eliminar esta notificación?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => borrarNotificacion(id) },
    ]);
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedTextSecondary style={{ marginTop: 8 }}>Cargando notificaciones…</ThemedTextSecondary>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <ThemedTitle style={styles.title}>Notificaciones</ThemedTitle>
        <TouchableOpacity
          onPress={marcarTodasLeidas}
          disabled={marcandoTodas}
          style={[
            styles.markAllButton,
            {
              opacity: marcandoTodas ? 0.6 : 1,
              backgroundColor: notificaciones.some((n) => !n.leida) ? '#6c2eb7' : '#999',
            },
          ]}
          accessibilityLabel="Marcar todas las notificaciones como leídas"
        >
          {marcandoTodas ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="check-all" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
      <FlatList
        data={notificaciones}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const actionLabel = getActionLabel(item);

          return (
            <ThemedView
              style={[
                styles.card,
                { backgroundColor: theme === 'dark' ? '#222' : '#f9f9f9' },
                !item.leida && { borderColor: colors.primary, borderWidth: 2 },
              ]}
            >
              <TouchableOpacity onPress={() => marcarLeida(item.id)}>
                <ThemedText style={styles.mensaje}>{item.mensaje}</ThemedText>
                <ThemedTextSecondary style={styles.fecha}>
                  {formatSevillaDateTime(item.fecha)}
                </ThemedTextSecondary>
              </TouchableOpacity>

              <View style={styles.cardFooter}>
                {!item.leida && (
                  <ThemedText style={[styles.badge, { backgroundColor: colors.primary }]}>
                    Nueva
                  </ThemedText>
                )}
                <View style={{ flex: 1 }} />
                {actionLabel && (
                  <TouchableOpacity
                    style={[styles.actionButton, { borderColor: colors.primary }]}
                    onPress={() => abrirDestino(item)}
                  >
                    <Icon
                      name={item.targetUserId ? 'account-arrow-right-outline' : 'calendar-search'}
                      size={16}
                      color={colors.primary}
                    />
                    <ThemedText style={[styles.actionText, { color: colors.primary }]}>
                      {actionLabel}
                    </ThemedText>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => confirmarBorrado(item.id)}
                  style={styles.trashButton}
                  accessibilityLabel="Eliminar notificación"
                >
                  <Icon name="trash-can-outline" size={20} color={colors.text + '66'} />
                </TouchableOpacity>
              </View>
            </ThemedView>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="bell-off-outline" size={48} color={colors.text + '44'} />
            <ThemedTextSecondary style={styles.emptyText}>
              Todo al día, no hay notificaciones nuevas
            </ThemedTextSecondary>
          </View>
        }
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: 'bold', flex: 1 },
  markAllButton: {
    width: 40,
    height: 40,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    padding: 16,
    borderRadius: 28,
    marginBottom: 12,
  },
  mensaje: { fontSize: 16 },
  fecha: { fontSize: 12, marginTop: 4 },
  badge: {
    color: '#fff',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'center',
    overflow: 'hidden',
    fontWeight: 'bold',
    fontSize: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: { fontSize: 12, fontWeight: '700' },
  trashButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    opacity: 0.6,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
