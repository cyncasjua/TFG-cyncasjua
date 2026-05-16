import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Modal,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AxiosError } from 'axios';
import {
  ThemedButton,
  ThemedCard,
  ThemedText,
  ThemedTextSecondary,
  ThemedTitle,
  ThemedView,
} from '../components';
import { useTheme } from '../hooks/useTheme';
import { api, getErrorMessage } from '../services';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/user';
import type { RootStackParamList } from '../navigation/types';
import { reportError } from '../utils/telemetry';

type Tab = 'stats' | 'users' | 'scraping';

type Props = NativeStackScreenProps<RootStackParamList, 'Admin'>;

type AdminStats = {
  totalUsuarios: number;
  totalEventos: number;
  eventosPendientes: number;
  eventosAprobados: number;
  eventosRechazados: number;
  eventosScrapeados: number;
  eventosUsuario: number;
};

export const AdminScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [changingRole, setChangingRole] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('stats');

  useEffect(() => {
    loadUsers();
    loadStats();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get<User[]>('/users');
      setUsers(res.data);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
      reportError('admin.load-users', 'Error cargando usuarios', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.get<AdminStats>('/users/admin/stats');
      setStats(res.data);
    } catch {
      // Stats son opcionales, no bloqueamos la pantalla si fallan
    }
  };

  const changeRole = async (userId: string, newRole: 'admin' | 'moderator' | 'user') => {
    try {
      setChangingRole(true);
      const response = await api.patch(`/users/${userId}/role`, { rol: newRole });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, rol: newRole } : u)));
      setShowModal(false);
      Alert.alert('\u00c9xito', `Rol actualizado a ${newRole}.`);
    } catch (err: unknown) {
      const error = err as AxiosError<{ message: string }> | Error;
      const errorMsg =
        error instanceof Error && 'response' in error
          ? (error as AxiosError<{ message: string }>).response?.data?.message ||
            error.message ||
            'No se pudo cambiar el rol.'
          : error instanceof Error
          ? error.message
          : 'No se pudo cambiar el rol.';
      if (error instanceof Error && 'response' in error) {
        const axiosErr = error as AxiosError;
        reportError('admin.change-role', 'Error cambiando rol de usuario', err, {
          status: axiosErr.response?.status,
          data: axiosErr.response?.data,
          message: error.message,
          url: axiosErr.config?.url,
        });
      }
      Alert.alert('Error', errorMsg);
    } finally {
      setChangingRole(false);
    }
  };

  const resetScraping = () => {
    Alert.alert(
      'Restablecer eventos scrapeados',
      'Se borrarán todos los eventos scrapeados automáticamente y se volverán a generar. Esto puede tardar varios minutos. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restablecer',
          style: 'destructive',
          onPress: async () => {
            try {
              setResetting(true);
              const res = await api.post('/scraping/reset', null, { timeout: 300000 });
              await AsyncStorage.removeItem('events_cache_v1');
              Alert.alert(
                'Completado',
                `${res.data.message}\nEliminados: ${res.data.deleted} | Guardados: ${res.data.saved}`
              );
            } catch (err) {
              Alert.alert('Error', getErrorMessage(err));
              reportError('admin.reset-scraping', 'Error restableciendo eventos scrapeados', err);
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  };

  const deleteUser = async (userId: string) => {
    Alert.alert(
      'Confirmar borrado',
      '¿Estás seguro de que quieres borrar esta cuenta? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              setChangingRole(true);
              await api.delete(`/users/${userId}`);
              setUsers((prev) => prev.filter((u) => u.id !== userId));
              setShowModal(false);
              Alert.alert('Éxito', 'Usuario borrado correctamente.');
            } catch (err: unknown) {
              const error = err as AxiosError<{ message: string }> | Error;
              const errorMsg =
                error instanceof Error && 'response' in error
                  ? (error as AxiosError<{ message: string }>).response?.data?.message ||
                    error.message ||
                    'No se pudo borrar el usuario.'
                  : error instanceof Error
                  ? error.message
                  : 'No se pudo borrar el usuario.';
              Alert.alert('Error', errorMsg);
            } finally {
              setChangingRole(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'stats', label: 'Estadísticas', icon: 'bar-chart' },
    { key: 'users', label: 'Usuarios', icon: 'people' },
    { key: 'scraping', label: 'Scraping', icon: 'build' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedTitle style={styles.title}>Panel de Administración</ThemedTitle>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <MaterialIcons
              name={tab.icon}
              size={18}
              color={activeTab === tab.key ? colors.primary : colors.textSecondary}
            />
            <ThemedText
              style={[styles.tabLabel, { color: activeTab === tab.key ? colors.primary : colors.textSecondary }]}
            >
              {tab.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pestaña Estadísticas */}
      {activeTab === 'stats' && (
        <ScrollView contentContainerStyle={styles.tabContent}>
          {!stats ? (
            <View style={styles.emptyStats}>
              <MaterialIcons name="bar-chart" size={48} color={colors.textSecondary + '55'} />
              <ThemedTextSecondary style={styles.emptyStatsText}>
                No se pudieron cargar las estadísticas.
              </ThemedTextSecondary>
            </View>
          ) : (
            <>
              <ThemedCard style={styles.statsCard}>
                <ThemedText style={styles.statsTitle}>Eventos</ThemedText>
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <ThemedText style={[styles.statValue, { color: colors.primary }]}>{stats.totalEventos}</ThemedText>
                    <ThemedTextSecondary style={styles.statLabel}>Total</ThemedTextSecondary>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText style={[styles.statValue, { color: colors.primary }]}>{stats.eventosAprobados}</ThemedText>
                    <ThemedTextSecondary style={styles.statLabel}>Aprobados</ThemedTextSecondary>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText style={[styles.statValue, { color: '#e67e22' }]}>{stats.eventosPendientes}</ThemedText>
                    <ThemedTextSecondary style={styles.statLabel}>Pendientes</ThemedTextSecondary>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText style={[styles.statValue, { color: colors.error }]}>{stats.eventosRechazados}</ThemedText>
                    <ThemedTextSecondary style={styles.statLabel}>Rechazados</ThemedTextSecondary>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText style={[styles.statValue, { color: colors.primary }]}>{stats.eventosScrapeados}</ThemedText>
                    <ThemedTextSecondary style={styles.statLabel}>Scrapeados</ThemedTextSecondary>
                  </View>
                  <View style={styles.statItem}>
                    <ThemedText style={[styles.statValue, { color: colors.primary }]}>{stats.eventosUsuario}</ThemedText>
                    <ThemedTextSecondary style={styles.statLabel}>De usuarios</ThemedTextSecondary>
                  </View>
                </View>
              </ThemedCard>
              <ThemedCard style={styles.statsCard}>
                <ThemedText style={styles.statsTitle}>Usuarios</ThemedText>
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <ThemedText style={[styles.statValue, { color: colors.primary }]}>{stats.totalUsuarios}</ThemedText>
                    <ThemedTextSecondary style={styles.statLabel}>Registrados</ThemedTextSecondary>
                  </View>
                </View>
              </ThemedCard>
            </>
          )}
        </ScrollView>
      )}

      {/* Pestaña Usuarios */}
      {activeTab === 'users' && (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.tabContent}
          renderItem={({ item }) => (
            <ThemedCard style={styles.userCard}>
              <ThemedView style={styles.userInfo}>
                <ThemedText style={styles.userName}>{item.nombre}</ThemedText>
                <ThemedTextSecondary style={styles.userEmail}>{item.email}</ThemedTextSecondary>
                <ThemedText style={[styles.userRole, { color: colors.primary }]}>
                  Rol: {item.rol}
                </ThemedText>
              </ThemedView>
              <ThemedView>
                <TouchableOpacity
                  onPress={() => { setSelectedUser(item); setShowModal(true); }}
                  style={styles.iconButton}
                  accessibilityLabel="Editar rol"
                >
                  <MaterialIcons name="edit" size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteUser(item.id)}
                  style={[styles.iconButton, { marginTop: 6 }]}
                  accessibilityLabel="Borrar usuario"
                >
                  <MaterialIcons name="delete" size={20} color={colors.error} />
                </TouchableOpacity>
              </ThemedView>
            </ThemedCard>
          )}
        />
      )}

      {/* Pestaña Scraping */}
      {activeTab === 'scraping' && (
        <ScrollView contentContainerStyle={styles.tabContent}>
          <ThemedCard style={styles.statsCard}>
            <ThemedText style={styles.statsTitle}>Gestión de scraping</ThemedText>
            <ThemedTextSecondary style={{ marginBottom: 16, lineHeight: 20 }}>
              Borra todos los eventos scrapeados automáticamente y los vuelve a generar desde las fuentes externas. Puede tardar varios minutos.
            </ThemedTextSecondary>
            <ThemedButton
              title={resetting ? 'Restableciendo...' : 'Restablecer eventos scrapeados'}
              variant="secondary"
              onPress={resetScraping}
              disabled={resetting}
            />
          </ThemedCard>
        </ScrollView>
      )}

      {selectedUser && (
        <Modal
          visible={showModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowModal(false)}
        >
          <ThemedView style={[styles.modalOverlay, { backgroundColor: `${colors.text}80` }]}>
            <ThemedCard style={styles.modalContent}>
              <ThemedTitle style={styles.modalTitle}>
                Cambiar rol de {selectedUser.nombre}
              </ThemedTitle>
              {['admin', 'moderator', 'user'].map((role) => (
                <ThemedButton
                  key={role}
                  title={changingRole ? 'Actualizando...' : role.charAt(0).toUpperCase() + role.slice(1)}
                  variant={selectedUser.rol === role ? 'primary' : 'secondary'}
                  onPress={() => changeRole(selectedUser.id, role as 'admin' | 'moderator' | 'user')}
                  disabled={changingRole}
                  style={styles.roleOption}
                />
              ))}
              <ThemedButton
                title="Cerrar"
                variant="secondary"
                onPress={() => setShowModal(false)}
                style={styles.closeButton}
              />
            </ThemedCard>
          </ThemedView>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 0 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  tabContent: { paddingBottom: 24 },
  emptyStats: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyStatsText: { textAlign: 'center', fontSize: 15, opacity: 0.6 },
  statsCard: { marginBottom: 16, padding: 14 },
  statsTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statItem: { width: '30%', alignItems: 'center', paddingVertical: 6 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, textAlign: 'center', marginTop: 2 },
  userCard: { marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  userEmail: { fontSize: 13, marginBottom: 4 },
  userRole: { fontSize: 12, fontWeight: '600' },
  iconButton: { paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 35, borderTopRightRadius: 35, padding: 20, paddingBottom: 30 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  roleOption: { marginBottom: 10 },
  closeButton: { marginTop: 12 },
});
