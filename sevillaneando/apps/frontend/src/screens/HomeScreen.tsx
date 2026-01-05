import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
// filepath: c:\Users\G513\Desktop\TFG-cyncasjua\sevillaneando\apps\frontend\src\screens\HomeScreen.tsx
// @ts-ignore
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getEvents } from '../services/api';
import { events as fallbackEvents } from '../seed/events';
import { RootStackParamList } from '../App';
import type { Event } from '../types/event';
import { useAuth } from '../hooks/useAuth';
import { ThemedView, ThemedCard, ThemedText, ThemedTextSecondary, ThemedTitle, ThemedButton } from '../components';
import { useTheme } from '../hooks/useTheme';
import { ImageBackground } from 'react-native';
import {ProfileHeader} from './ProfileHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const { role, logout } = useAuth();
  const { colors, setTheme, theme } = useTheme();

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError(null);
      try {
        //const remote = await getEvents();
        //setItems(remote);
        setItems(fallbackEvents);
        console.log(items);
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
  <ImageBackground
    source={require('../../assets/icon.png')}
    style={[styles.background, { backgroundColor: colors.background }]}
    imageStyle={styles.backgroundImage}
    resizeMode="cover"
  >
    <ThemedView style={styles.container}>
      <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
        <MaterialIcons name="menu" size={32} color="#6c2eb7" />
      </TouchableOpacity>

      <ThemedView style={styles.header}>
        <ThemedTitle>Eventos en Sevilla</ThemedTitle>
        <ThemedTextSecondary style={{ marginTop: 4 }}>Rol actual: {role}</ThemedTextSecondary>
      </ThemedView>

      {role === 'admin' && (
        <TouchableOpacity
          style={styles.adminButton}
          onPress={() => navigation.navigate('Admin')}
        >
          <MaterialIcons name="admin-panel-settings" size={28} color="#6c2eb7" />
        </TouchableOpacity>
      )}

      {error && <ThemedText style={{ color: colors.error, marginBottom: 8 }}>{error}</ThemedText>}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('EventDetail', { event: item })}>
            <ThemedCard>
              <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
              <ThemedTextSecondary style={{ marginBottom: 6 }}>{item.address}</ThemedTextSecondary>
              <ThemedTextSecondary numberOfLines={2}>{item.description}</ThemedTextSecondary>
              <ThemedTextSecondary>Fecha: {new Date(item.fechaInicio).toLocaleString()} - {new Date(item.fechaFin).toLocaleString()}</ThemedTextSecondary>
              <ThemedTextSecondary>Precio: {item.precio} €</ThemedTextSecondary>
              <ThemedTextSecondary>Categoría: {item.categoria?.nombre}</ThemedTextSecondary>
              <ThemedTextSecondary>Estado: {item.estado}</ThemedTextSecondary>
              <ThemedTextSecondary>Organizador: {item.creador?.nombre}</ThemedTextSecondary>
            </ThemedCard>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <ThemedView style={styles.separator} />}
        ListEmptyComponent={<ThemedText>No hay eventos disponibles.</ThemedText>}
      />

      {menuVisible && (
        <ThemedView style={styles.menuOverlay}>
          <ThemedView style={[styles.menuContainer, { backgroundColor: colors.card }]}>
              <ThemedTitle style={styles.menuTitle}>Menú</ThemedTitle>
              <ProfileHeader onPress={() => {
                setMenuVisible(false);
                navigation.navigate('EditProfile');
              }} />
            <ThemedView style={styles.menuSection}>
              <ThemedTextSecondary style={{ marginBottom: 8 }}>Tema:</ThemedTextSecondary>
              <ThemedView style={styles.themeRow}>
                <ThemedButton
                  title="Claro"
                  variant={theme === 'light' ? 'primary' : 'secondary'}
                  onPress={() => setTheme('light')}
                  style={styles.menuButtonOption}
                />
                <ThemedButton
                  title="Oscuro"
                  variant={theme === 'dark' ? 'primary' : 'secondary'}
                  onPress={() => setTheme('dark')}
                  style={styles.menuButtonOption}
                />
              </ThemedView>
            </ThemedView>
            <ThemedButton
              title="Cerrar sesión"
              variant="danger"
              onPress={onLogout}
              style={styles.menuButtonOption}
            />
            <TouchableOpacity
              style={styles.closeMenuButton}
              onPress={() => setMenuVisible(false)}
              accessibilityLabel="Cerrar menú"
            >
              <MaterialIcons name="close" size={32} color="#6c2eb7" />
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      )}
    </ThemedView>
  </ImageBackground>
);
};


const styles = StyleSheet.create({
  logo: { width: 32, height: 32, marginRight: 8 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  headerTitleText: { fontSize: 22, fontWeight: 'bold' },
  background: { flex: 1 },
  backgroundImage: { opacity: 0.2, transform: [{ scale: 1.5 }, { translateY: 40 }] },
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    marginTop: 60, 
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  menuButton: {
    position: 'absolute',
    top: 18,
    left: 18,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 8,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'trasparent',
    zIndex: 100,
    flexDirection: 'row',
  },
  menuContainer: {
    width: '80%', 
    height: '100%',
    padding: 24,
    borderTopRightRadius: 40,
    borderBottomRightRadius: 40,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 2, height: 0 },
    justifyContent: 'flex-start',
    alignItems: 'center', 
  },
  menuTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 18 },
  menuSection: { marginBottom: 24 },
  menuButtonOption: {
    marginBottom: 0,
    alignSelf: 'stretch',
  },  headerButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  smallButton: { paddingHorizontal: 14, paddingVertical: 8 },
  smallButtonText: { fontSize: 12 },
    themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  tinyButton: { paddingHorizontal: 10, paddingVertical: 6 },
  tinyButtonText: { fontSize: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  separator: { height: 12 },
    closeMenuButton: {
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 4,
  },
    adminButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 8,
  },
});
