import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { getEvents } from '../services/api';
import { events as fallbackEvents } from '../seed/events';
import { RootStackParamList } from '../App';
import type { Event } from '../types/event';
import { useAuth } from '../hooks/useAuth';
import { ThemedView, ThemedCard, ThemedText, ThemedTextSecondary, ThemedTitle, ThemedButton } from '../components';
import { useTheme } from '../hooks/useTheme';
import { ImageBackground } from 'react-native';
import { ProfileHeader } from './ProfileHeader';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [items, setItems] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const { role, logout } = useAuth();
  const { colors, setTheme, theme } = useTheme();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const remote = await getEvents();
      setItems(remote);
    } catch (err) {
      console.error('No se pudieron cargar eventos remotos', err);
      setError('Mostrando eventos de ejemplo (sin conexión con backend).');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents])
  );

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
        {role === 'user' && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('CreateEvent')}
            accessibilityLabel="Crear evento"
          >
            <MaterialIcons name="add-circle" size={56} color="#6c2eb7" />
          </TouchableOpacity>
        )}

        {role === 'moderator' && (
          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('ModeratorEvents')}
            accessibilityLabel="Aprobar eventos"
          >
            <MaterialIcons name="check-circle" size={56} color="#4caf50" />
          </TouchableOpacity>
        )}

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

        <TouchableOpacity
          style={styles.notificationsButton}
          onPress={() => navigation.navigate('Notifications')}
          accessibilityLabel="Ver notificaciones"
        >
          <MaterialIcons name="notifications" size={35} color="#ffd700" />
        </TouchableOpacity>

        {error && <ThemedText style={{ color: colors.error, marginBottom: 8 }}>{error}</ThemedText>}
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            console.log('Imagen del evento:', item.imagen);
            return (
              <TouchableOpacity onPress={() => navigation.navigate('EventDetail', { event: item })}>
                <ThemedCard style={{ marginBottom: 8, padding: 0, overflow: 'hidden' }}>
                  <ImageBackground
                    source={
                      item.imagen
                        ? { uri: item.imagen }
                        : require('../../assets/splash.png')
                    }
                    style={{ height: 120, justifyContent: 'flex-end' }}
                    imageStyle={{ opacity: 0.2 }}
                    resizeMode="cover"
                  >
                    <ThemedText
                      style={{
                        fontSize: 18,
                        fontWeight: 'bold',
                        color: theme === 'dark' ? '#fff' : '#222',
                        marginBottom: 2,
                        marginLeft: 14,
                        textShadowColor: theme === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.2)',
                        textShadowOffset: { width: 0, height: 2 },
                        textShadowRadius: 6,
                      }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.title}
                    </ThemedText>
                    <ThemedTextSecondary
                      style={{
                        fontSize: 13,
                        color: theme === 'dark' ? '#eee' : '#444',
                        marginLeft: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        textShadowColor: theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.1)',
                        textShadowOffset: { width: 0, height: 1 },
                        textShadowRadius: 2,
                      }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      <MaterialIcons name="place" size={16} color="#ffd700" />{' '}
                      {item.address}
                    </ThemedTextSecondary>
                  </ImageBackground>
                  <ThemedView style={{ padding: 12 }}>
                    <ThemedTextSecondary numberOfLines={2} style={{ marginBottom: 6 }}>
                      {item.description}
                    </ThemedTextSecondary>
                    <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <MaterialIcons name="event" size={16} color="#6c2eb7" />
                      <ThemedTextSecondary style={{ marginLeft: 4 }}>
                        {new Date(item.fechaInicio).toLocaleDateString()} - {new Date(item.fechaFin).toLocaleDateString()}
                      </ThemedTextSecondary>
                    </ThemedView>
                    <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <MaterialIcons name="category" size={16} color="#6c2eb7" />
                      <ThemedTextSecondary style={{ marginLeft: 4 }}>
                        {item.categoria?.nombre}
                      </ThemedTextSecondary>
                    </ThemedView>
                    <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <MaterialIcons name="person" size={16} color="#6c2eb7" />
                      <ThemedTextSecondary style={{ marginLeft: 4 }}>
                        {item.creador?.nombre}
                      </ThemedTextSecondary>
                    </ThemedView>
                    <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <MaterialIcons name="check-circle" size={16} color={item.estado === 'Aprobado' ? '#4caf50' : '#fbc02d'} />
                      <ThemedTextSecondary style={{ marginLeft: 4 }}>
                        {item.estado}
                      </ThemedTextSecondary>
                    </ThemedView>
                    <ThemedView style={{ alignItems: 'flex-end', marginTop: 8 }}>
                      <ThemedText style={{
                        fontSize: 18,
                        fontWeight: 'bold',
                        color: '#fff',
                        backgroundColor: '#6c2eb7',
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: 12,
                        overflow: 'hidden',
                        alignSelf: 'flex-end'
                      }}>
                        {item.precio === 0 ? 'Gratis' : `${item.precio} €`}
                      </ThemedText>
                    </ThemedView>
                  </ThemedView>
                </ThemedCard>
              </TouchableOpacity>

            );
          }
          }
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
  }, headerButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
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
    top: 19,
    right: 18,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 32,
    zIndex: 20,
    elevation: 8,
    backgroundColor: 'transparent',
  },
  fabLeft: {
    position: 'absolute',
    bottom: 32,
    left: 32,
    zIndex: 20,
    elevation: 8,
    backgroundColor: 'transparent',
  },
    notificationsButton: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    zIndex: 11,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 8,
  },
});
