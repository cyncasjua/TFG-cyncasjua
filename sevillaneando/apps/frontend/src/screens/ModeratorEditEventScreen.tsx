import React, { useState, useRef, useEffect } from 'react';
import dayjs from 'dayjs';
import {
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ScrollView,
  Keyboard,
  TouchableOpacity,
  Image,
  View,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from 'react-native';
import MapView, { Marker, UrlTile, MapPressEvent } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { ThemedView, ThemedText, ThemedTitle, ThemedButton, OsmAttribution, AppPickerModal } from '../components';
import { useTheme } from '../hooks/useTheme';
import { api, API_BASE_URL } from '../services';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePickerModalOriginal from 'react-native-modal-datetime-picker';
import { ComponentType } from 'react';
import { CalendarDateTimePicker } from '../components';
import { getFullImageUrl, getImageUrlCandidates } from '../utils/imageUrl';
import { OSM_TILE_URL_TEMPLATE, SEVILLE_COORDINATES } from '../utils/map';
import { toBackendDateTime } from '../utils/dateTime';

const DateTimePickerModal = DateTimePickerModalOriginal as unknown as ComponentType<any>;

type Props = NativeStackScreenProps<RootStackParamList, 'ModeratorEditEvent'>;
type Categoria = { id: string; nombre: string };

export const ModeratorEditEventScreen: React.FC<Props> = ({ route, navigation }) => {
  const { event } = route.params;

  // Parsear imagenes si vienen como JSON string
  let rawImagenes = event.imagenes ?? [];
  if (typeof rawImagenes === 'string') {
    try {
      rawImagenes = JSON.parse(rawImagenes);
    } catch {
      rawImagenes = [];
    }
  }
  if (!Array.isArray(rawImagenes)) {
    rawImagenes = [];
  }

  const initialEventImages = rawImagenes
    .map((image: string) => {
      const normalized = getFullImageUrl(image);
      return normalized;
    })
    .filter((image: string | undefined): image is string => Boolean(image));

  const isPrivateEvent = Boolean(event.privado);
  const mapRef = useRef<any>(null);
  const { colors } = useTheme();

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [address, setAddress] = useState(event.address);
  const [fechaInicio, setFechaInicio] = useState(event.fechaInicio);
  const [fechaFin, setFechaFin] = useState(event.fechaFin);
  const [showFechaInicio, setShowFechaInicio] = useState(false);
  const [showFechaFin, setShowFechaFin] = useState(false);
  const [latitude, setLatitude] = useState(
    event.location?.coordinates[1] ?? SEVILLE_COORDINATES.latitude
  );
  const [longitude, setLongitude] = useState(
    event.location?.coordinates[0] ?? SEVILLE_COORDINATES.longitude
  );
  const [mapDelta, setMapDelta] = useState({ latitudeDelta: 0.01, longitudeDelta: 0.01 });
  const [precio, setPrecio] = useState(String(event.precio ?? ''));
  const [precioMin, setPrecioMin] = useState(String(event.precioMin ?? ''));
  const [precioMax, setPrecioMax] = useState(String(event.precioMax ?? ''));
  const [categoriaId, setCategoriaId] = useState(event.categoria?.id ?? '');
  const [openCategoria, setOpenCategoria] = useState(false);
  const [dropdownItems, setDropdownItems] = useState<{ label: string; value: string }[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>(initialEventImages);
  const [localImageUris, setLocalImageUris] = useState<string[]>(initialEventImages);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    getFullImageUrl(event.imagen) ?? initialEventImages[0] ?? null
  );
  const [failedImageAttempts, setFailedImageAttempts] = useState<Record<number, number>>({});
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriasLoading, setCategoriasLoading] = useState(true);
  const [estado, setEstado] = useState(event.estado ?? 'Pendiente');
  const [openEstado, setOpenEstado] = useState(false);
  const [estadoItems, setEstadoItems] = useState([
    { label: 'Pendiente', value: 'Pendiente' },
    { label: 'Aprobado', value: 'Aprobado' },
    { label: 'Rechazado', value: 'Rechazado' },
  ]);
  const [loading, setLoading] = useState(false);
  const [recurrencia, setRecurrencia] = useState<string | null>((event as any).recurrencia ?? null);
  const [openRecurrencia, setOpenRecurrencia] = useState(false);
  const [recurrenciaItems] = useState([
    { label: 'Sin recurrencia', value: '' },
    { label: 'Diario', value: 'diario' },
    { label: 'Semanal', value: 'semanal' },
    { label: 'Quincenal', value: 'quincenal' },
    { label: 'Mensual', value: 'mensual' },
  ]);
  const [recurrenciaFin, setRecurrenciaFin] = useState<string>((event as any).recurrenciaFin ?? '');
  const [showRecurrenciaFin, setShowRecurrenciaFin] = useState(false);
  const descriptionRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const fechaInicioRef = useRef<TextInput>(null);
  const fechaFinRef = useRef<TextInput>(null);
  const precioRef = useRef<TextInput>(null);
  const precioMinRef = useRef<TextInput>(null);
  const precioMaxRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [scrollX, setScrollX] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);

  useEffect(() => {
    initialEventImages.forEach((uri) => {
      void Image.prefetch(uri);
    });
    if (coverImageUrl) {
      void Image.prefetch(coverImageUrl);
    }
  }, [coverImageUrl, initialEventImages]);

  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const res = await api.get('/categorias');
        setCategorias(res.data);
        setDropdownItems(res.data.map((cat: Categoria) => ({ label: cat.nombre, value: cat.id })));
      } catch (e) {
        Alert.alert('Error', 'No se pudieron cargar las categorías.');
      } finally {
        setCategoriasLoading(false);
      }
    };
    fetchCategorias();
  }, []);

  const pickImages = async () => {
    const remainingSlots = 5 - imageUrls.length;
    if (remainingSlots <= 0) {
      Alert.alert('Límite alcanzado', 'No puedes añadir más de 5 imágenes.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newUris = result.assets.map((asset) => asset.uri).slice(0, remainingSlots);
      const newUrls: string[] = [];
      for (const uri of newUris) {
        const formData = new FormData();
        formData.append('file', {
          uri,
          name: 'event.jpg',
          type: 'image/jpeg',
        } as any);
        try {
          const res = await fetch(`${API_BASE_URL}/events/upload-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'multipart/form-data' },
            body: formData,
          });
          const data = await res.json();
          const url = data.url.startsWith('http') ? data.url : `${API_BASE_URL}${data.url}`;
          newUrls.push(url);
        } catch (e) {
          Alert.alert('Error', 'No se pudo subir una imagen.');
        }
      }
      setLocalImageUris((prev) => [...prev, ...newUris]);
      setImageUrls((prev) => {
        const combined = [...prev, ...newUrls];
        if (!coverImageUrl && combined.length > 0) setCoverImageUrl(combined[0]);
        return combined;
      });
    }
  };

  const quitarImagen = (idx: number) => {
    const newUris = [...localImageUris];
    const newUrls = [...imageUrls];
    newUris.splice(idx, 1);
    newUrls.splice(idx, 1);
    setLocalImageUris(newUris);
    setImageUrls(newUrls);
    if (newUrls.length === 0) {
      setCoverImageUrl(null);
    } else if (coverImageUrl === imageUrls[idx]) {
      setCoverImageUrl(newUrls[0] || null);
    }
  };

  const geocodeAddress = async (address: string, showLoading = false) => {
    if (!address) return;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const result = data[0];

        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        setLatitude(lat);
        setLongitude(lon);
        setAddress(result.display_name || address);
        setMapDelta({ latitudeDelta: 0.0015, longitudeDelta: 0.0015 });

        setTimeout(() => {
          mapRef.current?.animateToRegion(
            {
              latitude: lat,
              longitude: lon,
              latitudeDelta: 0.0015,
              longitudeDelta: 0.0015,
            },
            500
          );
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
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'TuApp/1.0',
            'Accept-Language': 'es',
          },
        }
      );

      const data = await response.json();

      if (data?.display_name) {
        setAddress(data.display_name);
        return;
      }

      setAddress('Dirección no encontrada');
    } catch (e) {
      setAddress('Dirección no encontrada');
    }
  };

  const handleAddressBlur = () => {
    geocodeAddress(address);
  };

  const handleSave = async () => {
    if (
      !title ||
      !description ||
      !address ||
      latitude === null ||
      longitude === null ||
      !categoriaId
    ) {
      Alert.alert('Error', 'Asegúrate de completar todos los campos obligatorios.');
      return;
    }
    const precioVal = precio.trim() !== '' ? parseFloat(precio) : null;
    const precioMinVal = precioMin.trim() !== '' ? parseFloat(precioMin) : null;
    const precioMaxVal = precioMax.trim() !== '' ? parseFloat(precioMax) : null;
    const noPrecio = precioVal === null && precioMinVal === null && precioMaxVal === null;
    const rangoIncompleto = (precioMinVal !== null) !== (precioMaxVal !== null);
    const conflicto = precioVal !== null && (precioMinVal !== null || precioMaxVal !== null);
    if (noPrecio) {
      Alert.alert('Error', 'Indica un precio fijo o un rango de precio (mín y máx).');
      return;
    }
    if (rangoIncompleto) {
      Alert.alert('Error', 'Si usas rango de precio, rellena tanto el mínimo como el máximo.');
      return;
    }
    if (conflicto) {
      Alert.alert('Error', 'Usa solo precio fijo o rango (mín-máx), no ambos a la vez.');
      return;
    }
    setLoading(true);
    let payload: any;
    try {
      payload = {
        title,
        description,
        address,
        fechaInicio: toBackendDateTime(fechaInicio),
        fechaFin: toBackendDateTime(fechaFin),
        location: { type: 'Point', coordinates: [longitude, latitude] },
        precio: precio && precio.trim() !== '' ? parseFloat(precio) : null,
        precioMin: precioMin && precioMin.trim() !== '' ? parseFloat(precioMin) : null,
        precioMax: precioMax && precioMax.trim() !== '' ? parseFloat(precioMax) : null,
        categoriaId,
        estado,
        imagenes: imageUrls || undefined,
        imagen: coverImageUrl || undefined,
        recurrencia: recurrencia || undefined,
        recurrenciaFin: recurrenciaFin || undefined,
      };
      await api.put(`/events/${event.id}`, payload);
      Alert.alert('Éxito', 'Evento actualizado');
      navigation.goBack();
    } catch (error: any) {
      let msg = 'No se pudo actualizar el evento.';
      if (error?.response?.data?.message) {
        msg = error.response.data.message;
      } else if (error?.message) {
        msg = error.message;
      }
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
          <ThemedView style={styles.container}>
            <ThemedTitle style={{ marginBottom: 16 }}>Editar Evento</ThemedTitle>
            <ThemedText style={styles.label}>Título *</ThemedText>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Título del evento"
              placeholderTextColor={colors.text + '99'}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
              ]}
              returnKeyType="next"
              onSubmitEditing={() => descriptionRef.current?.focus()}
              blurOnSubmit={false}
            />
            <ThemedText style={styles.label}>Descripción *</ThemedText>
            <TextInput
              ref={descriptionRef}
              value={description}
              onChangeText={setDescription}
              placeholder="Descripción"
              placeholderTextColor={colors.text + '99'}
              multiline
              style={[
                styles.input,
                {
                  height: 80,
                  color: colors.text,
                  backgroundColor: colors.card,
                  borderColor: colors.primary,
                },
              ]}
              returnKeyType="next"
              onSubmitEditing={() => addressRef.current?.focus()}
              blurOnSubmit={false}
            />
            <ThemedText style={styles.label}>Dirección</ThemedText>
            <TextInput
              ref={addressRef}
              value={address}
              onChangeText={setAddress}
              placeholder="Dirección"
              placeholderTextColor={colors.text + '99'}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
              ]}
              onBlur={handleAddressBlur}
            />
            <ThemedText style={styles.label}>Buscar dirección o lugar</ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Buscar dirección o lugar..."
                placeholderTextColor={colors.text + '99'}
                style={[
                  styles.mapSearchInput,
                  {
                    flex: 1,
                    color: colors.text,
                    backgroundColor: colors.card,
                    borderColor: colors.primary,
                  },
                ]}
                returnKeyType="search"
                onSubmitEditing={() => geocodeAddress(address, true)}
              />
              <TouchableOpacity
                onPress={() => geocodeAddress(address, true)}
                style={styles.mapSearchButton}
              >
                <Icon name="magnify" size={24} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <ThemedText style={styles.label}>Ubicación en el mapa</ThemedText>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude,
                longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              onPress={(e: MapPressEvent) => {
                const newLat = e.nativeEvent.coordinate.latitude;
                const newLon = e.nativeEvent.coordinate.longitude;

                setLatitude(newLat);
                setLongitude(newLon);
                setMapDelta({ latitudeDelta: 0.0015, longitudeDelta: 0.0015 });

                reverseGeocode(newLat, newLon);

                mapRef.current?.animateToRegion(
                  {
                    latitude: newLat,
                    longitude: newLon,
                    latitudeDelta: 0.0015,
                    longitudeDelta: 0.0015,
                  },
                  500
                );
              }}
            >
              <UrlTile urlTemplate={OSM_TILE_URL_TEMPLATE} maximumZ={19} />
              <Marker coordinate={{ latitude, longitude }} />
            </MapView>
            <View style={{ marginBottom: 8 }}>
              <OsmAttribution compact />
            </View>
            <ThemedText style={styles.label}>Fecha de inicio (opcional)</ThemedText>
            <TouchableOpacity onPress={() => setShowFechaInicio(true)}>
              <TextInput
                ref={fechaInicioRef}
                value={fechaInicio ? dayjs(fechaInicio).format('YYYY-MM-DD HH:mm') : ''}
                placeholder="YYYY-MM-DD HH:mm"
                placeholderTextColor={colors.text + '99'}
                style={[
                  styles.input,
                  { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
                ]}
                editable={false}
                pointerEvents="none"
              />
            </TouchableOpacity>
            <CalendarDateTimePicker
              isVisible={showFechaInicio}
              value={fechaInicio}
              minimumDate={new Date()}
              onConfirm={(val) => {
                setFechaInicio(val);
                setShowFechaInicio(false);
              }}
              onCancel={() => setShowFechaInicio(false)}
            />
            <ThemedText style={styles.label}>Fecha de fin (opcional)</ThemedText>
            <TouchableOpacity onPress={() => setShowFechaFin(true)}>
              <TextInput
                ref={fechaFinRef}
                value={fechaFin ? dayjs(fechaFin).format('YYYY-MM-DD HH:mm') : ''}
                placeholder="YYYY-MM-DD HH:mm"
                placeholderTextColor={colors.text + '99'}
                style={[
                  styles.input,
                  { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
                ]}
                editable={false}
                pointerEvents="none"
              />
            </TouchableOpacity>
            <CalendarDateTimePicker
              isVisible={showFechaFin}
              value={fechaFin}
              minimumDate={
                fechaInicio && new Date(fechaInicio) > new Date()
                  ? new Date(fechaInicio)
                  : new Date()
              }
              onConfirm={(val) => {
                setFechaFin(val);
                setShowFechaFin(false);
              }}
              onCancel={() => setShowFechaFin(false)}
            />

            <ThemedText style={styles.label}>Privado</ThemedText>
            <TouchableOpacity style={styles.checkboxContainer} disabled activeOpacity={1}>
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: colors.primary,
                    backgroundColor: isPrivateEvent ? colors.primary : colors.card,
                  },
                ]}
              >
                {isPrivateEvent && <Icon name="check" size={16} color="#fff" />}
              </View>
              <ThemedText style={{ color: colors.text + 'AA' }}>
                Solo lectura para moderador
              </ThemedText>
            </TouchableOpacity>

            <ThemedText style={styles.label}>Precio: Fijo o Intervalo</ThemedText>
            <ThemedText style={{ fontSize: 12, color: colors.text + '77', marginBottom: 8 }}>
              Elige UNO: precio fijo (0 € = gratis) o un rango mín-máx. Campo obligatorio.
            </ThemedText>

            <ThemedText style={styles.label}>Precio Fijo (€) </ThemedText>
            <TextInput
              ref={precioRef}
              value={precio}
              onChangeText={setPrecio}
              placeholder="Ej: 15€"
              placeholderTextColor={colors.text + '99'}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
              ]}
              keyboardType="numeric"
              returnKeyType="next"
              onSubmitEditing={() => precioMinRef.current?.focus()}
              blurOnSubmit={false}
            />

            <ThemedText style={styles.label}>Precio Mínimo (€)</ThemedText>
            <TextInput
              ref={precioMinRef}
              value={precioMin}
              onChangeText={setPrecioMin}
              placeholder="Ej: 10€"
              placeholderTextColor={colors.text + '99'}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
              ]}
              keyboardType="numeric"
              returnKeyType="next"
              onSubmitEditing={() => precioMaxRef.current?.focus()}
              blurOnSubmit={false}
            />

            <ThemedText style={styles.label}>Precio Máximo (€) </ThemedText>
            <TextInput
              ref={precioMaxRef}
              value={precioMax}
              onChangeText={setPrecioMax}
              placeholder="Ej: 25€"
              placeholderTextColor={colors.text + '99'}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
              ]}
              keyboardType="numeric"
            />

            <ThemedText style={styles.label}>Categoría</ThemedText>
            {categoriasLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => setOpenCategoria(true)}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.primary,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      minHeight: 48,
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      fontSize: 15,
                      color: categoriaId ? colors.text : colors.text + '80',
                      flex: 1,
                    }}
                  >
                    {categoriaId
                      ? (dropdownItems.find((i) => i.value === categoriaId)?.label ?? 'Selecciona una categoría')
                      : 'Selecciona una categoría'}
                  </ThemedText>
                  <Icon name="chevron-down" size={22} color={colors.text} />
                </TouchableOpacity>
                <AppPickerModal
                  visible={openCategoria}
                  title="Categoría"
                  items={dropdownItems}
                  value={categoriaId}
                  onSelect={(val) => setCategoriaId(val)}
                  onClose={() => setOpenCategoria(false)}
                />
              </>
            )}
            <ThemedText style={styles.label}>Estado</ThemedText>
            <>
              <TouchableOpacity
                onPress={() => setOpenEstado(true)}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.primary,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 48,
                  },
                ]}
              >
                <ThemedText style={{ fontSize: 15, color: colors.text, flex: 1 }}>
                  {estadoItems.find((i) => i.value === estado)?.label ?? estado}
                </ThemedText>
                <Icon name="chevron-down" size={22} color={colors.text} />
              </TouchableOpacity>
              <AppPickerModal
                visible={openEstado}
                title="Estado"
                items={estadoItems}
                value={estado}
                onSelect={(val) => setEstado(val)}
                onClose={() => setOpenEstado(false)}
              />
            </>
            <ThemedText style={styles.label}>Recurrencia</ThemedText>
            <>
              <TouchableOpacity
                onPress={() => setOpenRecurrencia(true)}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.primary,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 48,
                    marginBottom: 10,
                  },
                ]}
              >
                <ThemedText
                  style={{
                    fontSize: 15,
                    color: recurrencia ? colors.text : colors.text + '80',
                    flex: 1,
                  }}
                >
                  {recurrenciaItems.find((i) => i.value === (recurrencia ?? ''))?.label ?? 'Sin recurrencia'}
                </ThemedText>
                <Icon name="chevron-down" size={22} color={colors.text} />
              </TouchableOpacity>
              <AppPickerModal
                visible={openRecurrencia}
                title="Recurrencia"
                items={recurrenciaItems}
                value={recurrencia ?? ''}
                onSelect={(val) => setRecurrencia(val || null)}
                onClose={() => setOpenRecurrencia(false)}
              />
            </>
            {!!recurrencia && (
              <>
                <ThemedText style={styles.label}>Fecha fin de recurrencia</ThemedText>
                <TouchableOpacity
                  onPress={() => setShowRecurrenciaFin(true)}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.primary,
                      justifyContent: 'center',
                    },
                  ]}
                >
                  <ThemedText style={{ color: recurrenciaFin ? colors.text : colors.text + '99' }}>
                    {recurrenciaFin
                      ? dayjs(recurrenciaFin).format('DD/MM/YYYY')
                      : 'Seleccionar fecha límite'}
                  </ThemedText>
                </TouchableOpacity>
                <DateTimePickerModal
                  isVisible={showRecurrenciaFin}
                  mode="date"
                  minimumDate={fechaInicio ? new Date(fechaInicio) : new Date()}
                  onConfirm={(date: Date) => {
                    setRecurrenciaFin(date.toISOString());
                    setShowRecurrenciaFin(false);
                  }}
                  onCancel={() => setShowRecurrenciaFin(false)}
                />
              </>
            )}
            <ThemedText style={styles.label}>Imagen del evento (Máx 5)</ThemedText>

            {localImageUris && localImageUris.length > 0 && (
              <View
                style={{ width: '100%', marginBottom: 8, position: 'relative', minHeight: 130 }}
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  contentContainerStyle={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minWidth: '100%',
                  }}
                  style={{ width: '100%' }}
                  ref={scrollRef}
                  onContentSizeChange={(w, h) => setMaxScroll(w - 360)}
                  onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
                  scrollEventThrottle={16}
                >
                  {localImageUris.map((uri, idx) => {
                    const candidates = getImageUrlCandidates(uri);
                    if (candidates.length === 0) {
                      return null;
                    }
                    const attempts = failedImageAttempts[idx] ?? 0;
                    const hasExhaustedCandidates = attempts >= candidates.length;
                    const currentUri = candidates[Math.min(attempts, candidates.length - 1)];
                    return (
                      <View key={idx} style={{ marginRight: 8, position: 'relative' }}>
                        <Image
                          source={
                            hasExhaustedCandidates
                              ? require('../../assets/splash.png')
                              : { uri: currentUri }
                          }
                          onError={() => {
                            setFailedImageAttempts((prev) => ({
                              ...prev,
                              [idx]: (prev[idx] ?? 0) + 1,
                            }));
                          }}
                          style={[
                            styles.imagePreview,
                            {
                              width: 120,
                              borderWidth: coverImageUrl === imageUrls[idx] ? 3 : 0,
                              borderColor:
                                coverImageUrl === imageUrls[idx] ? colors.primary : 'transparent',
                            },
                          ]}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            const newUris = [...localImageUris];
                            const newUrls = [...imageUrls];
                            newUris.splice(idx, 1);
                            newUrls.splice(idx, 1);
                            setLocalImageUris(newUris);
                            setImageUrls(newUrls);
                            setFailedImageAttempts({});
                            if (newUrls.length === 0) {
                              setCoverImageUrl(null);
                            } else if (coverImageUrl === imageUrls[idx]) {
                              setCoverImageUrl(newUrls[0] || null);
                            }
                          }}
                          style={styles.deleteImageBtn}
                        >
                          <Icon name="close" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setCoverImageUrl(imageUrls[idx])}
                          style={[
                            styles.coverImageBtn,
                            {
                              backgroundColor:
                                coverImageUrl === imageUrls[idx]
                                  ? colors.primary
                                  : 'rgba(0,0,0,0.6)',
                            },
                          ]}
                        >
                          <ThemedText style={{ color: '#fff', fontSize: 12 }}>
                            {coverImageUrl === imageUrls[idx] ? 'Portada' : 'Elegir portada'}
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {imageUrls.length < 5 && (
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImages}>
                <Icon name="image-plus" size={24} color={colors.primary} />
                <ThemedText style={{ color: colors.primary, marginLeft: 8 }}>
                  Añadir imágenes
                </ThemedText>
              </TouchableOpacity>
            )}
            <ThemedButton
              title={loading ? 'Guardando...' : 'Guardar cambios'}
              onPress={handleSave}
              disabled={loading}
            />
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
  input: { borderWidth: 1, borderRadius: 16, padding: 8, marginBottom: 8, borderColor: '#ccc' },
  map: { width: '100%', height: 180, borderRadius: 10, marginBottom: 12 },
  mapSearchInput: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
    marginRight: 8,
    borderColor: '#ccc',
  },
  mapSearchButton: { padding: 8 },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  imagePreview: { height: 120, borderRadius: 16 },
  deleteImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 18,
    padding: 2,
    zIndex: 2,
  },
  coverImageBtn: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 2,
  },
  imagePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    borderRadius: 16,
    marginTop: 8,
  },
  removeImageBtn: { backgroundColor: '#f44336', padding: 6, borderRadius: 12 },
});

export default ModeratorEditEventScreen;
