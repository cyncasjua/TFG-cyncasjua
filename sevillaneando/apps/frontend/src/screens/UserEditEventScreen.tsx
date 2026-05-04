import { PrivateEventLinkModal } from '../components';
import React, { useState, useRef, useEffect, ComponentType } from 'react';
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
  TouchableWithoutFeedback,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { ThemedView, ThemedText, ThemedTitle, ThemedButton, OsmAttribution } from '../components';
import { useTheme } from '../hooks/useTheme';
import { api, API_BASE_URL } from '../services';
import { useAuth } from '../hooks/useAuth';
import DropDownPicker from 'react-native-dropdown-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';
import DateTimePickerModalOriginal from 'react-native-modal-datetime-picker';
import { CalendarDateTimePicker } from '../components';
import { reportWarning } from '../utils/telemetry';
import { getFullImageUrl, getImageUrlCandidates } from '../utils/imageUrl';
import { OSM_TILE_URL_TEMPLATE, SEVILLE_COORDINATES } from '../utils/map';
import { toBackendDateTime } from '../utils/dateTime';

const DateTimePickerModal = DateTimePickerModalOriginal as unknown as ComponentType<any>;

type Props = NativeStackScreenProps<RootStackParamList, 'EditEvent'>;

type Categoria = {
  id: string;
  nombre: string;
};

const UserEditEventScreen: React.FC<Props> = ({ route, navigation }) => {
  const { event, onEventEdited } = route.params as { event: any; onEventEdited?: () => void };

  // Parsear imagenes si vienen como JSON string
  let rawImagenes = event.imagenes || [];
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

  const initialEventImages: string[] = rawImagenes
    .map((image: string) => {
      const normalized = getFullImageUrl(image);
      return normalized;
    })
    .filter((image: string | undefined): image is string => Boolean(image));

  const mapRef = useRef<any>(null);
  const { colors } = useTheme();
  const [showPrivateLinkModal, setShowPrivateLinkModal] = useState(false);
  const [eventLinkAcceso, setEventLinkAcceso] = useState<string | null>(null);

  const ArrowUpIcon = ({ style }: { style?: StyleProp<ViewStyle> }) => (
    <Icon name="chevron-up" size={24} color={colors.text} style={(style || {}) as ViewStyle} />
  );
  const ArrowDownIcon = ({ style }: { style?: StyleProp<ViewStyle> }) => (
    <Icon name="chevron-down" size={24} color={colors.text} style={(style || {}) as ViewStyle} />
  );

  const { user } = useAuth();

  const [title, setTitle] = useState(event.title || '');
  const [description, setDescription] = useState(event.description || '');
  const [address, setAddress] = useState(event.address || '');
  const [fechaInicio, setFechaInicio] = useState(event.fechaInicio || '');
  const [fechaFin, setFechaFin] = useState(event.fechaFin || '');
  const [showFechaInicio, setShowFechaInicio] = useState(false);
  const [showFechaFin, setShowFechaFin] = useState(false);

  const [estado, setEstado] = useState(event.estado || 'Pendiente');
  const [openEstado, setOpenEstado] = useState(false);
  const [estadoItems, setEstadoItems] = useState([{ label: 'Pendiente', value: 'Pendiente' }]);

  const [latitude, setLatitude] = useState<number | null>(
    event.location?.coordinates?.[1] ?? SEVILLE_COORDINATES.latitude
  );
  const [longitude, setLongitude] = useState<number | null>(
    event.location?.coordinates?.[0] ?? SEVILLE_COORDINATES.longitude
  );
  const [mapDelta, setMapDelta] = useState({ latitudeDelta: 0.01, longitudeDelta: 0.01 });

  const [precio, setPrecio] = useState(event.precio ? String(event.precio) : '');
  const [precioMin, setPrecioMin] = useState(event.precioMin ? String(event.precioMin) : '');
  const [precioMax, setPrecioMax] = useState(event.precioMax ? String(event.precioMax) : '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  const [categoriaId, setCategoriaId] = useState<string | null>(
    event.categoria.id || event.categoria?.id || null
  );
  const [openCategoria, setOpenCategoria] = useState(false);
  const [dropdownItems, setDropdownItems] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriasLoading, setCategoriasLoading] = useState(true);
  const [privado, setPrivado] = useState(event.privado || false);

  const descriptionRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const fechaInicioRef = useRef<TextInput>(null);
  const fechaFinRef = useRef<TextInput>(null);
  const precioRef = useRef<TextInput>(null);
  const precioMinRef = useRef<TextInput>(null);
  const precioMaxRef = useRef<TextInput>(null);

  const [localImageUris, setLocalImageUris] = useState<string[]>(initialEventImages);
  const [imageUrls, setImageUrls] = useState<string[]>(initialEventImages);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    getFullImageUrl(event.imagen) || initialEventImages[0] || null
  );
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
  const [failedImageAttempts, setFailedImageAttempts] = useState<Record<number, number>>({});

  const scrollRef = useRef<ScrollView>(null);
  const [maxScroll, setMaxScroll] = useState(0);
  const [scrollX, setScrollX] = useState(0);

  useEffect(() => {
    initialEventImages.forEach((uri: string) => {
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

      setLocalImageUris((prev) => [...prev, ...newUris]);

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

      setImageUrls((prev) => {
        const combined = [...prev, ...newUrls];
        if (!coverImageUrl && combined.length > 0) setCoverImageUrl(combined[0]);
        return combined;
      });
    }
  };

  const geocodeAddress = async (address: string, showLoading = false) => {
    if (!address) return;
    if (showLoading) setSearchLoading(true);
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
            { latitude: lat, longitude: lon, latitudeDelta: 0.0015, longitudeDelta: 0.0015 },
            500
          );
        }, 100);
      } else {
        Alert.alert('No encontrado', 'No se ha encontrado la dirección o lugar especificado.');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo buscar la dirección o lugar.');
    } finally {
      if (showLoading) setSearchLoading(false);
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
      reportWarning('user-edit-event.reverse-geocode', 'Error en geocodificación inversa', e);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      geocodeAddress(searchQuery, true);
    }
  };

  const handleEditEvent = async () => {
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
    if (!user?.id) {
      Alert.alert('Error', 'No se ha encontrado el usuario actual.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title,
        description,
        address,
        fechaInicio: toBackendDateTime(fechaInicio),
        fechaFin: toBackendDateTime(fechaFin),
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        precio: precio && precio.trim() !== '' ? parseFloat(precio) : null,
        precioMin: precioMin && precioMin.trim() !== '' ? parseFloat(precioMin) : null,
        precioMax: precioMax && precioMax.trim() !== '' ? parseFloat(precioMax) : null,
        privado,
        categoriaId,
        estado,
        imagenes: imageUrls || [],
        imagen: coverImageUrl || undefined,
        recurrencia: recurrencia || undefined,
        recurrenciaFin: recurrenciaFin || undefined,
      };

      const wasPublic = !event.privado;
      const willBePrivate = privado;

      const res = await api.put(`/events/${event.id}`, payload);
      const linkAcceso = res.data?.linkAcceso;

      if (wasPublic && willBePrivate && linkAcceso) {
        setEventLinkAcceso(linkAcceso);
        setShowPrivateLinkModal(true);
      } else {
        Alert.alert('Éxito', 'El evento ha sido actualizado correctamente.');
        if (onEventEdited) onEventEdited();
        navigation.goBack();
      }
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
        >
          <ThemedView style={styles.container}>
            {privado && eventLinkAcceso && (
              <PrivateEventLinkModal
                visible={showPrivateLinkModal}
                linkAcceso={eventLinkAcceso}
                eventTitle={title}
                onClose={() => {
                  setShowPrivateLinkModal(false);
                  if (onEventEdited) onEventEdited();
                  navigation.goBack();
                }}
              />
            )}
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
              onConfirm={(val) => { setFechaInicio(val); setShowFechaInicio(false); }}
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
              minimumDate={fechaInicio ? new Date(fechaInicio) : new Date()}
              onConfirm={(val) => { setFechaFin(val); setShowFechaFin(false); }}
              onCancel={() => setShowFechaFin(false)}
            />

            <ThemedText style={styles.label}>Privado</ThemedText>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setPrivado(!privado)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: colors.primary,
                    backgroundColor: privado ? colors.primary : colors.card,
                  },
                ]}
              >
                {privado && <Icon name="check" size={16} color="#fff" />}
              </View>
            </TouchableOpacity>

            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
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
                  onSubmitEditing={handleSearch}
                  editable={!searchLoading}
                />
                <TouchableOpacity
                  onPress={handleSearch}
                  style={styles.mapSearchButton}
                  disabled={searchLoading}
                >
                  {searchLoading ? (
                    <ActivityIndicator color={colors.primary} size={20} />
                  ) : (
                    <Icon name="magnify" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              </View>
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.primary,
                    minHeight: 44,
                    justifyContent: 'center',
                  },
                ]}
              >
                <ThemedText
                  style={{
                    color: address ? colors.text : colors.text + '99',
                    fontSize: 16,
                  }}
                  numberOfLines={3}
                >
                  {address || 'Dirección'}
                </ThemedText>
              </View>
            </View>

            <ThemedText style={styles.label}>Ubicación en el mapa</ThemedText>
            <View
              style={{
                height: 220,
                borderRadius: 18,
                overflow: 'hidden',
                marginBottom: 10,
                borderWidth: 1,
                borderColor: colors.primary,
                position: 'relative',
              }}
            >
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                initialRegion={{
                  latitude: latitude ?? SEVILLE_COORDINATES.latitude,
                  longitude: longitude ?? SEVILLE_COORDINATES.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                onPress={(e) => {
                  const lat = e.nativeEvent.coordinate.latitude;
                  const lon = e.nativeEvent.coordinate.longitude;
                  setLatitude(lat);
                  setLongitude(lon);
                  setMapDelta({ latitudeDelta: 0.0015, longitudeDelta: 0.0015 });
                  mapRef.current?.animateToRegion(
                    {
                      latitude: lat,
                      longitude: lon,
                      latitudeDelta: 0.0015,
                      longitudeDelta: 0.0015,
                    },
                    500
                  );
                  reverseGeocode(lat, lon);
                }}
              >
                {latitude !== null && longitude !== null && (
                  <Marker coordinate={{ latitude, longitude }} />
                )}
                <UrlTile urlTemplate={OSM_TILE_URL_TEMPLATE} maximumZ={19} />
              </MapView>
            </View>
            <View style={{ marginBottom: 8 }}>
              <OsmAttribution compact />
            </View>
            <ThemedText style={{ marginBottom: 8, color: colors.text + '99' }}>
              {latitude && longitude
                ? `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`
                : 'Toca el mapa para seleccionar la ubicación'}
            </ThemedText>

            <ThemedText style={styles.label}>Precios</ThemedText>
            <ThemedText style={{ fontSize: 12, color: colors.text + '77', marginBottom: 8 }}>
              Elige UNO: precio fijo (0 € = gratis) o un rango mín-máx. Campo obligatorio.
            </ThemedText>

            <TextInput
              ref={precioRef}
              value={precio}
              onChangeText={setPrecio}
              placeholder="Precio Fijo (Ej: 15)"
              keyboardType="numeric"
              placeholderTextColor={colors.text + '99'}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
              ]}
            />
            <TextInput
              ref={precioMinRef}
              value={precioMin}
              onChangeText={setPrecioMin}
              placeholder="Precio Mínimo (Ej: 10)"
              keyboardType="numeric"
              placeholderTextColor={colors.text + '99'}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
              ]}
            />
            <TextInput
              ref={precioMaxRef}
              value={precioMax}
              onChangeText={setPrecioMax}
              placeholder="Precio Máximo (Ej: 25)"
              keyboardType="numeric"
              placeholderTextColor={colors.text + '99'}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
              ]}
            />

            <ThemedText style={styles.label}>Estado</ThemedText>
            <DropDownPicker
              open={openEstado}
              value={estado}
              items={estadoItems}
              setOpen={setOpenEstado}
              setValue={setEstado}
              setItems={setEstadoItems}
              style={{
                backgroundColor: colors.card,
                borderColor: colors.primary,
                minHeight: 40,
                borderRadius: 16,
                marginBottom: 10,
              }}
              dropDownContainerStyle={{ backgroundColor: colors.card, borderColor: colors.primary }}
              textStyle={{ color: colors.text }}
              placeholder="Pendiente"
              placeholderStyle={{ color: colors.text + '99' }}
              zIndex={900}
              listMode="SCROLLVIEW"
              ArrowUpIconComponent={ArrowUpIcon}
              ArrowDownIconComponent={ArrowDownIcon}
            />

            <ThemedText style={styles.label}>Recurrencia</ThemedText>
            <DropDownPicker
              open={openRecurrencia}
              value={recurrencia}
              items={recurrenciaItems}
              setOpen={setOpenRecurrencia}
              setValue={setRecurrencia}
              setItems={() => {}}
              placeholder="Sin recurrencia"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.primary,
                minHeight: 40,
                borderRadius: 16,
                marginBottom: 10,
              }}
              dropDownContainerStyle={{ backgroundColor: colors.card, borderColor: colors.primary }}
              textStyle={{ color: colors.text }}
              placeholderStyle={{ color: colors.text + '99' }}
              zIndex={950}
              listMode="SCROLLVIEW"
              ArrowUpIconComponent={ArrowUpIcon}
              ArrowDownIconComponent={ArrowDownIcon}
            />
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

            <ThemedText style={styles.label}>Categoría</ThemedText>
            {categoriasLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginBottom: 10 }} />
            ) : (
              <DropDownPicker
                open={openCategoria}
                value={categoriaId}
                items={dropdownItems}
                setOpen={setOpenCategoria}
                setValue={setCategoriaId}
                setItems={setDropdownItems}
                placeholder="Selecciona una categoría..."
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.primary,
                  minHeight: 40,
                  borderRadius: 16,
                  marginBottom: 10,
                }}
                dropDownContainerStyle={{
                  backgroundColor: colors.card,
                  borderColor: colors.primary,
                }}
                textStyle={{ color: colors.text }}
                placeholderStyle={{ color: colors.text + '99' }}
                zIndex={1000}
                listMode="SCROLLVIEW"
                ArrowUpIconComponent={ArrowUpIcon}
                ArrowDownIconComponent={ArrowDownIcon}
              />
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

            <View style={{ marginTop: 24 }}>
              <ThemedButton
                title={loading ? 'Enviando...' : 'Guardar Cambios'}
                onPress={handleEditEvent}
                disabled={loading}
              />
            </View>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

export default UserEditEventScreen;

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 16,
  },
  container: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  mapSearchInput: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginRight: 8,
  },
  mapSearchButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreview: {
    height: 120,
    borderRadius: 16,
  },
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
});
