import React, { useState, useRef, useEffect } from 'react';
import { Alert, StyleSheet, KeyboardAvoidingView, Platform, TextInput, ScrollView, Keyboard, TouchableOpacity, Image, View, ActivityIndicator, TouchableWithoutFeedback } from 'react-native';
import MapView, { Marker, UrlTile, MapPressEvent } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { ThemedView, ThemedText, ThemedTitle, ThemedButton } from '../components';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'ModeratorEditEvent'>;
type Categoria = { id: string; nombre: string };

export const ModeratorEditEventScreen: React.FC<Props> = ({ route, navigation }) => {
  const { event } = route.params;
  const mapRef = useRef<any>(null);
  const { colors } = useTheme();
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [address, setAddress] = useState(event.address);
  const [fechaInicio, setFechaInicio] = useState(event.fechaInicio);
  const [fechaFin, setFechaFin] = useState(event.fechaFin);
  const [latitude, setLatitude] = useState(event.location?.coordinates[1] ?? 37.3891);
  const [longitude, setLongitude] = useState(event.location?.coordinates[0] ?? -5.9845);
  const [mapDelta, setMapDelta] = useState({ latitudeDelta: 0.01, longitudeDelta: 0.01 });
  const [precio, setPrecio] = useState(String(event.precio ?? ''));
  const [categoriaId, setCategoriaId] = useState(event.categoria?.id ?? '');
  const [imageUrl, setImageUrl] = useState(event.imagen ?? '');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriasLoading, setCategoriasLoading] = useState(true);
  const [estado, setEstado] = useState(event.estado ?? 'Pendiente');
  const [loading, setLoading] = useState(false);
  const descriptionRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const fechaInicioRef = useRef<TextInput>(null);
  const fechaFinRef = useRef<TextInput>(null);
  const precioRef = useRef<TextInput>(null);

  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const res = await api.get('/categorias');
        setCategorias(res.data);
      } catch (e) {
        Alert.alert('Error', 'No se pudieron cargar las categorías.');
      } finally {
        setCategoriasLoading(false);
      }
    };
    fetchCategorias();
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const localUri = result.assets[0].uri;
      const formData = new FormData();
      formData.append('file', {
        uri: localUri,
        name: 'event.jpg',
        type: 'image/jpeg',
      } as any);
      try {
        const res = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/events/upload-image`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'multipart/form-data' },
            body: formData,
          }
        );
        const data = await res.json();
        const url = data.url.startsWith('http')
          ? data.url
          : `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}${data.url}`;
        setLocalImageUri(localUri);
        setImageUrl(url);
      } catch (e) {
        Alert.alert('Error', 'No se pudo subir la imagen.');
        setLocalImageUri(null);
        setImageUrl('');
      }
    }
  };

  const quitarImagen = () => {
    setLocalImageUri(null);
    setImageUrl('');
  };

  const geocodeAddress = async (address: string, showLoading = false) => {
    if (!address) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setLatitude(lat);
        setLongitude(lon);
        setMapDelta({ latitudeDelta: 0.0015, longitudeDelta: 0.0015 });
        setTimeout(() => {
          mapRef.current?.animateToRegion({
            latitude: lat,
            longitude: lon,
            latitudeDelta: 0.0015,
            longitudeDelta: 0.0015,
          }, 500);
        }, 100);
      } else {
        Alert.alert('No encontrado', 'No se ha encontrado la dirección o lugar especificado.');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo buscar la dirección o lugar.');
    }
  };

  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const data = await response.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      reverseGeocode(latitude, longitude);
    }
  }, [latitude, longitude]);

  const handleAddressBlur = () => {
    geocodeAddress(address);
  };

  const handleSave = async () => {
    if (!title || !description || !address || !fechaInicio || !fechaFin || latitude === null || longitude === null || !precio || !categoriaId) {
      Alert.alert('Error', 'Por favor, completa todos los campos obligatorios.');
      return;
    }
    setLoading(true);
    let payload: any;
    try {
      payload = {
        title,
        description,
        address,
        fechaInicio,
        fechaFin,
        location: { type: 'Point', coordinates: [longitude, latitude] },
        precio: parseFloat(precio),
        categoriaId,
        estado,
        imagen: imageUrl || undefined,
      };
      console.log('Payload enviado al backend:', payload);
      await api.put(`/events/${event.id}`, payload);
      Alert.alert('Éxito', 'Evento actualizado');
      navigation.goBack();
    } catch (error) {
      let msg = 'No se pudo actualizar el evento.';
      if (error && typeof error === 'object' && error !== null && 'response' in error && (error as any).response && 'data' in (error as any).response) {
        console.log('Error al actualizar evento:', (error as any).response.data);
        msg += '\n' + JSON.stringify((error as any).response.data);
      } else {
        console.log('Error al actualizar evento:', error);
      }
      Alert.alert('Error', msg + '\nPayload: ' + JSON.stringify(payload));
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
          <ThemedView style={styles.container}>
            <ThemedTitle style={{ marginBottom: 16 }}>Editar Evento</ThemedTitle>
            <ThemedText style={styles.label}>Título</ThemedText>
            <TextInput value={title} onChangeText={setTitle} placeholder="Título del evento" placeholderTextColor={colors.text + '99'} style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]} returnKeyType="next" onSubmitEditing={() => descriptionRef.current?.focus()} blurOnSubmit={false} />
            <ThemedText style={styles.label}>Descripción</ThemedText>
            <TextInput ref={descriptionRef} value={description} onChangeText={setDescription} placeholder="Descripción" placeholderTextColor={colors.text + '99'} multiline style={[styles.input, { height: 80, color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]} returnKeyType="next" onSubmitEditing={() => addressRef.current?.focus()} blurOnSubmit={false} />
            <ThemedText style={styles.label}>Dirección</ThemedText>
            <TextInput ref={addressRef} value={address} onChangeText={setAddress} placeholder="Dirección" placeholderTextColor={colors.text + '99'} style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]} onBlur={handleAddressBlur} />
            <ThemedText style={styles.label}>Buscar dirección o lugar</ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <TextInput value={address} onChangeText={setAddress} placeholder="Buscar dirección o lugar..." placeholderTextColor={colors.text + '99'} style={[styles.mapSearchInput, { flex: 1, color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]} returnKeyType="search" onSubmitEditing={() => geocodeAddress(address, true)} />
              <TouchableOpacity onPress={() => geocodeAddress(address, true)} style={styles.mapSearchButton}>
                <Icon name="magnify" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <ThemedText style={styles.label}>Ubicación en el mapa</ThemedText>
            <MapView ref={mapRef} style={styles.map} initialRegion={{ latitude, longitude, ...mapDelta }} region={{ latitude, longitude, ...mapDelta }} onPress={(e: MapPressEvent) => { setLatitude(e.nativeEvent.coordinate.latitude); setLongitude(e.nativeEvent.coordinate.longitude); }}>
              <UrlTile urlTemplate="http://c.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
              <Marker coordinate={{ latitude, longitude }} />
            </MapView>
            <ThemedText style={styles.label}>Fecha de inicio</ThemedText>
            <TextInput ref={fechaInicioRef} value={fechaInicio} onChangeText={setFechaInicio} placeholder="YYYY-MM-DDTHH:mm:ss" placeholderTextColor={colors.text + '99'} style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]} />
            <ThemedText style={styles.label}>Fecha de fin</ThemedText>
            <TextInput ref={fechaFinRef} value={fechaFin} onChangeText={setFechaFin} placeholder="YYYY-MM-DDTHH:mm:ss" placeholderTextColor={colors.text + '99'} style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]} />
            <ThemedText style={styles.label}>Precio (€)</ThemedText>
            <TextInput ref={precioRef} value={precio} onChangeText={setPrecio} placeholder="Precio" placeholderTextColor={colors.text + '99'} style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]} keyboardType="numeric" />
            <ThemedText style={styles.label}>Categoría</ThemedText>
            {categoriasLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Picker selectedValue={categoriaId} onValueChange={setCategoriaId} style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]}>
                <Picker.Item label="Selecciona una categoría" value="" />
                {categorias.map((cat) => (
                  <Picker.Item key={cat.id} label={cat.nombre} value={cat.id} />
                ))}
              </Picker>
            )}
            <ThemedText style={styles.label}>Estado</ThemedText>
            <TextInput value={estado} onChangeText={setEstado} placeholder="Estado" placeholderTextColor={colors.text + '99'} style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]} />
            <ThemedText style={styles.label}>Imagen</ThemedText>
            {imageUrl ? (
              <View style={{ alignItems: 'center', marginBottom: 8 }}>
                <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
                <TouchableOpacity onPress={quitarImagen} style={styles.removeImageBtn}>
                  <ThemedText style={{ color: '#fff' }}>Quitar imagen</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <ThemedButton title="Seleccionar imagen" onPress={pickImage} />
            )}
            <ThemedButton title={loading ? 'Guardando...' : 'Guardar cambios'} onPress={handleSave} disabled={loading} />
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  scrollContainer: { flexGrow: 1 },
  label: { fontWeight: 'bold', marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 8, borderColor: '#ccc' },
  map: { width: '100%', height: 180, borderRadius: 10, marginBottom: 12 },
  mapSearchInput: { borderWidth: 1, borderRadius: 8, padding: 8, marginRight: 8, borderColor: '#ccc' },
  mapSearchButton: { padding: 8 },
  imagePreview: { width: 180, height: 120, borderRadius: 10, marginBottom: 8 },
  removeImageBtn: { backgroundColor: '#f44336', padding: 6, borderRadius: 6 },
});

export default ModeratorEditEventScreen;
