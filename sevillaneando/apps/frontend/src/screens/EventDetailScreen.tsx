import React, { useMemo } from 'react';
import { Linking, Platform, SafeAreaView, StyleSheet } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useNsfwGuard } from '../hooks/useNsfwGuard';
import { useTheme } from '../hooks/useTheme';
import { ThemedButton, ThemedText, ThemedTextSecondary, ThemedTitle, ThemedView } from '../components';
import type { Event } from '../types/event';
import { storage } from '../firebase/config';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'EventDetail'>;

function parsePoint(event: Event) {
  if (event.latitude !== undefined && event.longitude !== undefined) {
    return { latitude: event.latitude, longitude: event.longitude };
  }
  if (event.location) {
    const match = event.location.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
    if (match) {
      return { latitude: parseFloat(match[2]), longitude: parseFloat(match[1]) };
    }
  }
  return null;
}

export const EventDetailScreen: React.FC<Props> = ({ route }) => {
  const { event } = route.params;
  const { evaluateImage } = useNsfwGuard();
  const { colors } = useTheme();

  const coords = useMemo(() => parsePoint(event), [event]);

  const uploadProbe = async () => {
    try {
      const objectRef = ref(storage, `probe/${Date.now()}.txt`);
      await uploadString(objectRef, 'sevillaneando storage probe', 'raw');
      const url = await getDownloadURL(objectRef);
      console.log('Storage probe URL:', url);
    } catch (err) {
      console.error('Fallo la subida a Storage', err);
    }
  };

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

  if (!coords) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}>
        <ThemedText>No hay coordenadas para este evento.</ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedTitle style={styles.title}>{event.title}</ThemedTitle>
      <ThemedTextSecondary style={styles.subtitle}>{event.address}</ThemedTextSecondary>
      <ThemedText style={styles.description}>{event.description}</ThemedText>

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 14 },
  description: { fontSize: 14, lineHeight: 20 },
  mapContainer: { height: 260, borderRadius: 12, overflow: 'hidden', borderWidth: 1 }
});
