import React, { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { Linking, Platform, StyleSheet, ImageBackground } from 'react-native';
// filepath: c:\Users\G513\Desktop\TFG-cyncasjua\sevillaneando\apps\frontend\src\screens\HomeScreen.tsx
// @ts-ignore
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useNsfwGuard } from '../hooks/useNsfwGuard';
import { useTheme } from '../hooks/useTheme';
import { ThemedButton, ThemedText, ThemedTextSecondary, ThemedTitle, ThemedView } from '../components';
import type { Event } from '../types/event';
import { storage } from '../firebase/config';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { useIsFocused } from '@react-navigation/native';
import { useColorScheme } from 'react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'EventDetail'>;

const uploadProbe = async () => {
  try {
    const storageRef = ref(storage, 'demo.txt');
    await uploadString(storageRef, 'Contenido de prueba', 'raw');
    const url = await getDownloadURL(storageRef);
    console.log('Archivo subido:', url);
  } catch (error) {
    console.error('Error al subir archivo:', error);
  }
};

function parsePoint(event: Event) {
  if (event.latitude !== undefined && event.longitude !== undefined) {
    return { latitude: event.latitude, longitude: event.longitude };
  }
  if (event.location) {
    if (typeof event.location === 'string') {
      const locationStr: string = event.location;
      const match = locationStr.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
      if (match) {
        return { latitude: parseFloat(match[2]), longitude: parseFloat(match[1]) };
      }
    } else if (
      typeof event.location === 'object' &&
      event.location.type === 'Point' &&
      Array.isArray(event.location.coordinates) &&
      event.location.coordinates.length === 2
    ) {
      return { latitude: event.location.coordinates[1], longitude: event.location.coordinates[0] };
    }
  }
  return null;
}

export const EventDetailScreen: React.FC<Props> = ({ route }) => {
  const { event } = route.params;
  const { evaluateImage } = useNsfwGuard();
  const { colors } = useTheme();
  const colorScheme = useColorScheme();
  const coords = useMemo(() => parsePoint(event), [event]);
  const isFocused = useIsFocused();

  const openExternalNavigation = () => {
    if (!coords) return;
    const scheme = Platform.select({ ios: 'maps://0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${coords.latitude},${coords.longitude}`;
    const label = encodeURIComponent(event.title);
    const url = Platform.select({
      ios: `${scheme}${latLng}(${label})`,
      android: `${scheme}${latLng}(${label})`
    });
    if (url) Linking.openURL(url);
  };

  if (!isFocused) return null;

  if (!coords) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}>
        <ThemedText>No hay coordenadas para este evento.</ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <ImageBackground
      source={event.imagen ? { uri: event.imagen } : require('../../assets/splash.png')}
      style={styles.background}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
    >
      <SafeAreaView style={[styles.container, { backgroundColor: 'transparent', zIndex: 2 }]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <ThemedView style={[{ borderRadius: 18, padding: 16, marginBottom: 12 }, { backgroundColor: colors.card + 'DD' }]}>
            <ThemedTitle
              style={[
                styles.title,
                {
                  color: colorScheme === 'dark' ? '#fff' : '#111',
                  marginBottom: 4,
                },
              ]}
            >
              {event.title}
            </ThemedTitle>
            <ThemedTextSecondary style={[styles.subtitle, { marginBottom: 8 }]}>
              <MaterialIcons name="place" size={16} color="#6c2eb7" /> {event.address}
            </ThemedTextSecondary>
            <ThemedText style={[styles.description, { marginBottom: 8 }]}>
              {event.description}
            </ThemedText>
            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialIcons name="event" size={16} color="#6c2eb7" />
              <ThemedTextSecondary style={{ marginLeft: 4 }}>
                {new Date(event.fechaInicio).toLocaleString()} - {new Date(event.fechaFin).toLocaleString()}
              </ThemedTextSecondary>
            </ThemedView>
            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialIcons name="category" size={16} color="#6c2eb7" />
              <ThemedTextSecondary style={{ marginLeft: 4 }}>
                {event.categoria?.nombre}
              </ThemedTextSecondary>
            </ThemedView>
            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialIcons name="person" size={16} color="#6c2eb7" />
              <ThemedTextSecondary style={{ marginLeft: 4 }}>
                {event.creador?.nombre}
              </ThemedTextSecondary>
            </ThemedView>
            <ThemedView style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialIcons name="check-circle" size={16} color={event.estado === 'Aprobado' ? '#4caf50' : '#fbc02d'} />
              <ThemedTextSecondary style={{ marginLeft: 4 }}>
                {event.estado}
              </ThemedTextSecondary>
            </ThemedView>
            <ThemedView style={{ alignItems: 'flex-end', marginBottom: 8 }}>
              <ThemedText style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: '#fff',
                backgroundColor: '#6c2eb7',
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 14,
                overflow: 'hidden',
                alignSelf: 'flex-end'
              }}>
                {event.precio === 0 ? 'Gratis' : `${event.precio} €`}
              </ThemedText>
            </ThemedView>
          </ThemedView>
          <ThemedView style={[styles.mapContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MapView
              style={StyleSheet.absoluteFillObject}
              initialRegion={{
                latitude: coords.latitude,
                longitude: coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01
              }}
            >
              <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
              <Marker coordinate={coords} title={event.title} />
            </MapView>
          </ThemedView>
          <ThemedButton title="Abrir en Google/Apple Maps" onPress={openExternalNavigation} />
          <ThemedButton
            title="Probar moderación NSFW (demo)"
            variant="secondary"
            onPress={async () => {
              const safe = await evaluateImage('https://example.com/demo.jpg');
              console.log('Imagen segura:', safe);
            }}
          />
          <ThemedButton title="Probar subida a Storage" variant="secondary" onPress={uploadProbe} />
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 14 },
  description: { fontSize: 14, lineHeight: 20 },
  mapContainer: { height: 260, borderRadius: 30, overflow: 'hidden', borderWidth: 1 },
  background: { flex: 1, padding: 16, gap: 12 },
  backgroundImage: { opacity: 1, transform: [{ scale: 1.5 }, { translateY: 40 }] },
});