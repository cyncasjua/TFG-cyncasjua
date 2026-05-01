import React, { useState, useEffect } from 'react';
import {
  TextInput,
  FlatList,
  StyleSheet,
  Alert,
  ImageBackground,
  TouchableOpacity,
  Modal,
  Keyboard,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAuthContext } from '../context/AuthContext';
import { api, getErrorMessage } from '../services';
import {
  ThemedView,
  ThemedCard,
  ThemedText,
  ThemedTextSecondary,
  ThemedTitle,
} from '../components';
import { useTheme } from '../hooks/useTheme';
import { reportError } from '../utils/telemetry';

type Category = {
  id?: string;
  nombre: string;
  descripcion: string;
};

const CategoriesScreen = () => {
  const { user } = useAuthContext();
  const { colors } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get('/categorias');
      const data = res.data;
      setCategories(data);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    }
    setLoading(false);
  };

  const handleCreateOrEdit = async () => {
    setLoading(true);
    try {
      if (editMode && editId) {
        await api.put(`/categorias/${editId}`, { nombre, descripcion });
        setCategories((prev) =>
          prev.map((cat) => (cat.id === editId ? { ...cat, nombre, descripcion } : cat))
        );
      } else {
        const res = await api.post('/categorias', { nombre, descripcion });
        setCategories((prev) => [...prev, res.data]);
      }
      setNombre('');
      setDescripcion('');
      setEditMode(false);
      setEditId(null);
    } catch (error) {
      Alert.alert('Error', getErrorMessage(error));
    }
    setLoading(false);
    fetchCategories();
  };

  return (
    <ImageBackground
      source={require('../../assets/icon.png')}
      style={[styles.background, { backgroundColor: colors.background }]}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
    >
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id?.toString() || item.nombre}
          contentContainerStyle={{ paddingBottom: 140, paddingTop: 16, paddingHorizontal: 2 }}
          ItemSeparatorComponent={() => <ThemedView style={{ height: 18 }} />}
          renderItem={({ item }) => (
            <ThemedCard
              style={[
                styles.item,
                { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1.5 },
              ]}
            >
              <ThemedView style={styles.itemHeader}>
                <MaterialIcons
                  name="label"
                  size={22}
                  color={colors.primary}
                  style={{ marginRight: 8 }}
                />
                <ThemedText style={styles.itemTitle}>{item.nombre}</ThemedText>
                {user?.rol === 'admin' && (
                  <ThemedView style={{ flexDirection: 'row', marginLeft: 'auto' }}>
                    <TouchableOpacity
                      style={{ padding: 4, marginRight: 2 }}
                      onPress={() => {
                        setEditMode(true);
                        setEditId(item.id || null);
                        setNombre(item.nombre);
                        setDescripcion(item.descripcion);
                        setModalVisible(true);
                      }}
                    >
                      <MaterialIcons name="edit" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ padding: 4, marginLeft: 2 }}
                      onPress={async () => {
                        Alert.alert(
                          'Borrar categoría',
                          `¿Seguro que quieres borrar "${item.nombre}"?`,
                          [
                            { text: 'Cancelar', style: 'cancel' },
                            {
                              text: 'Borrar',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  setLoading(true);
                                  await api.delete(`/categorias/${item.id}`);
                                  fetchCategories();
                                  Alert.alert('Eliminada', 'Categoría borrada correctamente');
                                } catch (error: any) {
                                  reportError('categories.delete', 'Error al borrar categoría', error, {
                                    responseData: error?.response?.data,
                                  });
                                  let msg = 'No se pudo borrar la categoría';
                                  if (error?.response?.data?.message) {
                                    msg += `: ${error.response.data.message}`;
                                  }
                                  Alert.alert('Error', msg);
                                }
                                setLoading(false);
                              },
                            },
                          ]
                        );
                      }}
                    >
                      <MaterialIcons name="delete" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </ThemedView>
                )}
              </ThemedView>
              <ThemedTextSecondary style={styles.itemDesc}>{item.descripcion}</ThemedTextSecondary>
            </ThemedCard>
          )}
          refreshing={loading}
          onRefresh={fetchCategories}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <ThemedView style={styles.headerRow}>
              <MaterialIcons
                name="category"
                size={34}
                color={colors.primary}
                style={{ marginRight: 10 }}
              />
              <ThemedTitle style={styles.title}>Categorías</ThemedTitle>
            </ThemedView>
          }
          ListEmptyComponent={
            !loading ? (
              <ThemedTextSecondary
                style={{ textAlign: 'center', marginVertical: 28, fontSize: 14 }}
              >
                No hay categorías disponibles.
              </ThemedTextSecondary>
            ) : null
          }
        />
        {user?.rol === 'admin' && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => {
              setEditMode(false);
              setEditId(null);
              setNombre('');
              setDescripcion('');
              setModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <MaterialIcons name="add-circle" size={48} color={colors.primary} />
          </TouchableOpacity>
        )}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
          <ThemedView style={styles.modalOverlay}>
            <ThemedCard
              style={[
                styles.form,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.primary,
                  borderWidth: 1.5,
                  marginTop: 80,
                },
              ]}
            >
              <ThemedView style={[styles.formHeader, { justifyContent: 'space-between' }]}>
                <ThemedView style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialIcons
                    name={editMode ? 'edit' : 'add-circle'}
                    size={24}
                    color={colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <ThemedTitle style={styles.formTitle}>
                    {editMode ? 'Editar categoría' : 'Nueva categoría'}
                  </ThemedTitle>
                </ThemedView>
                <TouchableOpacity
                  onPress={() => Keyboard.dismiss()}
                  style={{ padding: 4, marginLeft: 8 }}
                >
                  <MaterialIcons name="keyboard-hide" size={22} color={colors.primary} />
                </TouchableOpacity>
              </ThemedView>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: colors.primary,
                    backgroundColor: colors.background,
                    fontWeight: 'bold',
                    fontSize: 15,
                  },
                ]}
                placeholder="Nombre"
                placeholderTextColor={colors.textSecondary}
                value={nombre}
                onChangeText={setNombre}
                autoCapitalize="sentences"
                returnKeyType="next"
              />
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    borderColor: colors.primary,
                    backgroundColor: colors.background,
                    minHeight: 50,
                    fontSize: 14,
                  },
                ]}
                placeholder="Descripción"
                placeholderTextColor={colors.textSecondary}
                value={descripcion}
                onChangeText={setDescripcion}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <ThemedView
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  marginTop: 10,
                  alignItems: 'center',
                }}
              >
                <TouchableOpacity
                  style={[styles.createButton, { backgroundColor: colors.error }]}
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="close" size={20} color="#fff" />
                  <ThemedText style={styles.createButtonText}>Cancelar</ThemedText>
                </TouchableOpacity>
                <ThemedView style={{ width: 18 }} />
                <TouchableOpacity
                  style={[
                    styles.createButton,
                    { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 },
                  ]}
                  onPress={async () => {
                    await handleCreateOrEdit();
                    setModalVisible(false);
                  }}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="check" size={20} color="#fff" />
                  <ThemedText style={styles.createButtonText}>
                    {editMode ? 'Guardar' : 'Crear'}
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            </ThemedCard>
          </ThemedView>
        </Modal>
      </ThemedView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  backgroundImage: { opacity: 0.2, transform: [{ scale: 1.5 }, { translateY: 40 }] },
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
    marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', letterSpacing: 1.1 },
  item: {
    marginBottom: 0,
    padding: 16,
    borderRadius: 22,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  itemTitle: { fontSize: 15, fontWeight: 'bold', letterSpacing: 0.5 },
  itemDesc: { fontSize: 13, color: '#888', marginLeft: 2, marginTop: 2 },
  form: {
    borderRadius: 24,
    padding: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  formHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  formTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 0, letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderRadius: 16, padding: 10, marginBottom: 12, fontSize: 13 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 7,
    letterSpacing: 0.5,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 32,
    zIndex: 20,
    elevation: 8,
    backgroundColor: 'transparent',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CategoriesScreen;
