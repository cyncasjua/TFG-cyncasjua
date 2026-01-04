import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Alert
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';import { api } from '../services/api';
import { User } from '../types/user';
import { RootStackParamList } from '../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Admin'>;

export const AdminScreen: React.FC<Props> = () => {
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
      Alert.alert('Error', 'No se pudieron cargar los usuarios.');
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
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, rol: newRole } : u))
    );
    setShowModal(false);
    Alert.alert('Éxito', `Rol actualizado a ${newRole}.`);
  } catch (err: any) {
    const errorMsg = err?.response?.data?.message || err?.message || 'No se pudo cambiar el rol.';
    console.error('Error completo:', {
      status: err?.response?.status,
      data: err?.response?.data,
      message: err?.message,
      url: err?.config?.url
    });
    Alert.alert('Error', errorMsg);
  } finally {
    setChangingRole(false);
  }
};

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Gestión de Usuarios</Text>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{item.nombre}</Text>
              <Text style={styles.userEmail}>{item.email}</Text>
              <Text style={styles.userRole}>Rol: {item.rol}</Text>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                setSelectedUser(item);
                setShowModal(true);
              }}
            >
              <Text style={styles.editButtonText}>Editar rol</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {selectedUser && (
        <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Cambiar rol de {selectedUser.nombre}</Text>

              {['admin', 'moderator', 'user'].map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleOption, selectedUser.rol === role && styles.roleOptionActive]}
                  onPress={() => changeRole(selectedUser.id, role as 'admin' | 'moderator' | 'user')}
                  disabled={changingRole}
                >
                  {changingRole ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.roleOptionText}>{role.charAt(0).toUpperCase() + role.slice(1)}</Text>
                  )}
                </TouchableOpacity>
              ))}

              <TouchableOpacity style={styles.closeButton} onPress={() => setShowModal(false)}>
                <Text style={styles.closeButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f7f7f7' },
  title: { fontSize: 22, fontWeight: '800', color: '#111', marginBottom: 16 },
  userCard: { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 4 },
  userEmail: { fontSize: 13, color: '#555', marginBottom: 4 },
  userRole: { fontSize: 12, color: '#1d4ed8', fontWeight: '600' },
  editButton: { backgroundColor: '#1d4ed8', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  editButtonText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#111' },
  roleOption: { backgroundColor: '#e5e7eb', padding: 14, borderRadius: 10, marginBottom: 10, alignItems: 'center' },
  roleOptionActive: { backgroundColor: '#1d4ed8' },
  roleOptionText: { fontWeight: '600', color: '#111' },
  closeButton: { backgroundColor: '#6b7280', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  closeButtonText: { color: '#fff', fontWeight: '600' }
});
