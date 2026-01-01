import React, { useMemo } from 'react';
import { Linking, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useNsfwGuard } from '../hooks/useNsfwGuard';
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
      <SafeAreaView style={styles.centered}>
        <Text>No hay coordenadas para este evento.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.subtitle}>{event.address}</Text>
      <Text style={styles.description}>{event.description}</Text>

      <View style={styles.mapContainer}>
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
      </View>

      <TouchableOpacity style={styles.button} onPress={openExternalNavigation}>
        <Text style={styles.buttonText}>Abrir en Google/Apple Maps</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={async () => {
          const safe = await evaluateImage('https://example.com/demo.jpg');
          console.log('Imagen segura:', safe);
        }}
      >
        <Text style={styles.secondaryButtonText}>Probar moderación NSFW (demo)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={uploadProbe}>
        <Text style={styles.secondaryButtonText}>Probar subida a Storage</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12, backgroundColor: '#f7f7f7' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  subtitle: { fontSize: 14, color: '#444' },
  description: { fontSize: 14, color: '#333', lineHeight: 20 },
  mapContainer: { height: 260, borderRadius: 12, overflow: 'hidden', backgroundColor: '#ddd' },
  button: { backgroundColor: '#1d4ed8', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#d0d7de', alignItems: 'center' },
  secondaryButtonText: { color: '#1d4ed8', fontWeight: '700' }
});
