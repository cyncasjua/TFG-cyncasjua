import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Modal, Alert } from 'react-native';
import { View } from 'react-native';
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
import { api, getErrorMessage } from '../services/api';
import { User } from '../types/user';
import { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Admin'>;

export const AdminScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [changingRole, setChangingRole] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get<User[]>('/users');
      setUsers(res.data);
    } catch (err) {
      Alert.alert('Error', getErrorMessage(err));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (userId: string, newRole: 'admin' | 'moderator' | 'user') => {
    try {
      setChangingRole(true);
      console.log('Cambiando rol:', { userId, newRole });
      const response = await api.patch(`/users/${userId}/role`, { rol: newRole });
      console.log('Respuesta exitosa:', response.data);
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
        console.error('Error completo:', {
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedTitle style={styles.title}>Gestión de Usuarios</ThemedTitle>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
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
              <ThemedButton
                title="Editar rol"
                onPress={() => {
                  setSelectedUser(item);
                  setShowModal(true);
                }}
                style={styles.editButton}
              />
              <ThemedButton
                title="Borrar"
                variant="danger"
                onPress={() => deleteUser(item.id)}
                style={[styles.editButton, { marginTop: 6 }]}
              />
            </ThemedView>
          </ThemedCard>
        )}
      />

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
                  title={
                    changingRole ? 'Actualizando...' : role.charAt(0).toUpperCase() + role.slice(1)
                  }
                  variant={selectedUser.rol === role ? 'primary' : 'secondary'}
                  onPress={() =>
                    changeRole(selectedUser.id, role as 'admin' | 'moderator' | 'user')
                  }
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
  background: { flex: 1, padding: 16 },
  backgroundImage: { opacity: 0.2, transform: [{ scale: 1.5 }, { translateY: 40 }] },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 0 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  userCard: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  userEmail: { fontSize: 13, marginBottom: 4 },
  userRole: { fontSize: 12, fontWeight: '600' },
  editButton: { paddingHorizontal: 12, paddingVertical: 8 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    padding: 20,
    paddingBottom: 30,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  roleOption: { marginBottom: 10 },
  closeButton: { marginTop: 12 },
});
