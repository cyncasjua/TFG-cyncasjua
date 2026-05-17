import React, { useState, useRef, useEffect } from 'react';
import {
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  ScrollView,
  Keyboard,
  TouchableOpacity,
  Image,
  View,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import {
  ThemedView,
  ThemedText,
  ThemedTextSecondary,
  ThemedTitle,
  ThemedButton,
  OsmAttribution,
  AppPickerModal,
  FieldLabel,
} from '../components';
import { useTheme } from '../hooks/useTheme';
import { api, API_BASE_URL, getErrorMessage } from '../services';
import { useAuth } from '../hooks/useAuth';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';
import { ComponentType } from 'react';
import { CalendarDateTimePicker } from '../components';
import DateTimePickerModalOriginal from 'react-native-modal-datetime-picker';
const DateTimePickerModal = DateTimePickerModalOriginal as unknown as ComponentType<any>;
import { PrivateEventLinkModal } from '../components';
import { reportWarning } from '../utils/telemetry';
import { OSM_TILE_URL_TEMPLATE, SEVILLE_COORDINATES } from '../utils/map';
import { formatDateTime, toBackendDateTime } from '../utils/dateTime';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateEvent'>;

type Categoria = {
  id: string;
  nombre: string;
};

const DEFAULT_MAP_DELTA = { latitudeDelta: 0.01, longitudeDelta: 0.01 };
const FOCUSED_MAP_DELTA = { latitudeDelta: 0.0015, longitudeDelta: 0.0015 };

const toAbsoluteApiUrl = (urlOrPath: string) =>
  urlOrPath.startsWith('http') ? urlOrPath : `${API_BASE_URL}${urlOrPath}`;

const parseOptionalNumber = (value: string) => {
  const normalized = value.trim();
  return normalized === '' ? null : parseFloat(normalized);
};

export const CreateEventScreen: React.FC<Props> = ({ navigation }) => {
  const mapRef = useRef<MapView | null>(null);
  const { colors } = useTheme();

  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [showFechaInicio, setShowFechaInicio] = useState(false);
  const [showFechaFin, setShowFechaFin] = useState(false);
  const [estado, setEstado] = useState('Pendiente');
  const [openEstado, setOpenEstado] = useState(false);
  const [estadoItems, setEstadoItems] = useState([{ label: 'Pendiente', value: 'Pendiente' }]);
  // Centro de Sevilla por defecto
  const [latitude, setLatitude] = useState<number | null>(SEVILLE_COORDINATES.latitude);
  const [longitude, setLongitude] = useState<number | null>(SEVILLE_COORDINATES.longitude);
  const [mapDelta, setMapDelta] = useState(DEFAULT_MAP_DELTA);
  const [precio, setPrecio] = useState('');
  const [precioMin, setPrecioMin] = useState('');
  const [precioMax, setPrecioMax] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [openCategoria, setOpenCategoria] = useState(false);
  const [dropdownItems, setDropdownItems] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoriasLoading, setCategoriasLoading] = useState(true);
  const [privado, setPrivado] = useState(false);
  const [showPrivateLinkModal, setShowPrivateLinkModal] = useState(false);
  const [eventLinkAcceso, setEventLinkAcceso] = useState<string | null>(null);
  const descriptionRef = useRef<TextInput>(null);
  const precioRef = useRef<TextInput>(null);
  const precioMinRef = useRef<TextInput>(null);
  const precioMaxRef = useRef<TextInput>(null);
  const imageScrollRef = useRef<ScrollView>(null);
  const [imageScrollX, setImageScrollX] = useState(0);
  const [imageMaxScroll, setImageMaxScroll] = useState(0);
  const [imageContainerWidth, setImageContainerWidth] = useState(0);
  const [mapActive, setMapActive] = useState(false);
  const [localImageUris, setLocalImageUris] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [recurrencia, setRecurrencia] = useState<string | null>(null);
  const [openRecurrencia, setOpenRecurrencia] = useState(false);
  const [recurrenciaItems] = useState([
    { label: 'Sin recurrencia', value: '' },
    { label: 'Diario', value: 'diario' },
    { label: 'Semanal', value: 'semanal' },
    { label: 'Quincenal', value: 'quincenal' },
    { label: 'Mensual', value: 'mensual' },
  ]);
  const [recurrenciaFin, setRecurrenciaFin] = useState('');
  const [showRecurrenciaFin, setShowRecurrenciaFin] = useState(false);

  const focusMapOnLocation = (lat: number, lon: number) => {
    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lon,
        latitudeDelta: FOCUSED_MAP_DELTA.latitudeDelta,
        longitudeDelta: FOCUSED_MAP_DELTA.longitudeDelta,
      },
      500
    );
  };

  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const res = await api.get('/categorias');
        setDropdownItems(res.data.map((cat: Categoria) => ({ label: cat.nombre, value: cat.id })));
      } catch (e) {
        Alert.alert('Error', 'No se pudieron cargar las categorías.');
      } finally {
        setCategoriasLoading(false);
      }
    };
    fetchCategorias();
    return () => {};
  }, []);

  const uploadEventImage = async (uri: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: 'event.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);

    const res = await fetch(`${API_BASE_URL}/events/upload-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data' },
      body: formData,
    });

    const data = await res.json();
    return toAbsoluteApiUrl(data.url);
  };

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
        try {
          const url = await uploadEventImage(uri);
          newUrls.push(url);
        } catch (e) {
          Alert.alert('Error', 'No se pudo subir una imagen.');
          reportWarning('create-event.upload-image', 'Error subiendo imagen', e);
        }
      }

      setImageUrls((prev) => {
        const combined = [...prev, ...newUrls];
        if (!coverImageUrl && combined.length > 0) setCoverImageUrl(combined[0]);
        return combined;
      });
    }
  };

  const removeImageAtIndex = (idx: number) => {
    const newUris = [...localImageUris];
    const newUrls = [...imageUrls];
    newUris.splice(idx, 1);
    newUrls.splice(idx, 1);
    setLocalImageUris(newUris);
    setImageUrls(newUrls);

    if (newUrls.length === 0) {
      setCoverImageUrl(null);
      return;
    }

    if (coverImageUrl === imageUrls[idx]) {
      setCoverImageUrl(newUrls[0] || null);
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
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setLatitude(lat);
        setLongitude(lon);
        setMapDelta(FOCUSED_MAP_DELTA);
        setTimeout(() => {
          focusMapOnLocation(lat, lon);
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
      reportWarning('create-event.reverse-geocode', 'Error en geocodificación inversa', e);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      geocodeAddress(searchQuery, true);
    }
  };

  const handleMapPress = (lat: number, lon: number) => {
    setLatitude(lat);
    setLongitude(lon);
    setMapDelta(FOCUSED_MAP_DELTA);
    reverseGeocode(lat, lon);
    focusMapOnLocation(lat, lon);
  };

  const buildCreateEventPayload = () => {
    const precioVal = parseOptionalNumber(precio);
    const precioMinVal = parseOptionalNumber(precioMin);
    const precioMaxVal = parseOptionalNumber(precioMax);
    return {
      title,
      description,
      address,
      fechaInicio: toBackendDateTime(fechaInicio),
      fechaFin: toBackendDateTime(fechaFin),
      location: {
        type: 'Point' as const,
        coordinates: [longitude, latitude],
      },
      ...(precioVal != null ? { precio: precioVal } : {}),
      ...(precioMinVal != null ? { precioMin: precioMinVal } : {}),
      ...(precioMaxVal != null ? { precioMax: precioMaxVal } : {}),
      privado,
      categoriaId,
      creadorId: user?.id,
      imagenes: imageUrls || undefined,
      imagen: coverImageUrl || undefined,
      recurrencia: recurrencia || undefined,
      recurrenciaFin: recurrenciaFin || undefined,
    };
  };

  const handleCreateEvent = async () => {
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
    const rangoIncompleto = (precioMinVal !== null) !== (precioMaxVal !== null);
    const conflicto = precioVal !== null && (precioMinVal !== null || precioMaxVal !== null);
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
      const payload = buildCreateEventPayload();
      const response = await api.post('/events', payload);
      setEventLinkAcceso(response.data.linkAcceso || null);
      if (privado && response.data.linkAcceso) {
        setShowPrivateLinkModal(true);
      } else {
        Alert.alert(
          'Éxito',
          'Evento enviado para revisión. Será visible tras la aprobación de un moderador.'
        );
        navigation.goBack();
      }
    } catch (error: unknown) {
      Alert.alert('Error', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          scrollEnabled={!mapActive}
        >
          <ThemedView style={styles.container}>
            <ThemedTitle style={{ marginBottom: 16 }}>Crear Evento</ThemedTitle>
            <ThemedTextSecondary style={styles.requiredHint}>
              Los campos marcados como obligatorios deben completarse para enviar el evento.
            </ThemedTextSecondary>
            <FieldLabel title="Título" status="required" />
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
            <FieldLabel title="Descripción" status="required" />
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
              onSubmitEditing={Keyboard.dismiss}
              blurOnSubmit={false}
            />

            <FieldLabel
              title="Fecha de inicio"
              status="optional"
              helperText="Si no la indicas, el evento se publicará sin fecha y podrás añadirla más tarde."
            />
            <TouchableOpacity onPress={() => setShowFechaInicio(true)}>
              <TextInput
                value={formatDateTime(fechaInicio)}
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
            <FieldLabel title="Fecha de fin" status="optional" />
            <TouchableOpacity onPress={() => setShowFechaFin(true)}>
              <TextInput
                value={formatDateTime(fechaFin)}
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
              onConfirm={(val) => {
                setFechaFin(val);
                setShowFechaFin(false);
              }}
              onCancel={() => setShowFechaFin(false)}
            />
            <FieldLabel title="Privado" status="optional" />
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

            <FieldLabel title="Dirección o lugar" status="required" />
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
                  style={{ color: address ? colors.text : colors.text + '99', fontSize: 16 }}
                  numberOfLines={3}
                >
                  {address || 'Dirección'}
                </ThemedText>
              </View>
            </View>

            <FieldLabel title="Ubicación en el mapa" status="required" />
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
              onTouchEnd={() => setMapActive(false)}
              onTouchCancel={() => setMapActive(false)}
            >
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                initialRegion={{
                  latitude: latitude ?? SEVILLE_COORDINATES.latitude,
                  longitude: longitude ?? SEVILLE_COORDINATES.longitude,
                  latitudeDelta: DEFAULT_MAP_DELTA.latitudeDelta,
                  longitudeDelta: DEFAULT_MAP_DELTA.longitudeDelta,
                }}
                scrollEnabled={mapActive}
                zoomEnabled={mapActive}
                rotateEnabled={false}
                pitchEnabled={false}
                onPress={(e) => {
                  const lat = e.nativeEvent.coordinate.latitude;
                  const lon = e.nativeEvent.coordinate.longitude;
                  handleMapPress(lat, lon);
                }}
              >
                {latitude !== null && longitude !== null && (
                  <Marker coordinate={{ latitude, longitude }} />
                )}
                <UrlTile urlTemplate={OSM_TILE_URL_TEMPLATE} maximumZ={19} />
              </MapView>
              {!mapActive && (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 0,
                    right: 0,
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.45)',
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                    }}
                  >
                    <ThemedText style={{ color: '#fff', fontSize: 11 }}>
                      Mantén pulsado para mover el mapa
                    </ThemedText>
                  </View>
                </View>
              )}
              {!mapActive && (
                <Pressable
                  style={{ ...StyleSheet.absoluteFillObject }}
                  onLongPress={() => setMapActive(true)}
                  delayLongPress={400}
                />
              )}
            </View>
            <View style={{ marginBottom: 8 }}>
              <OsmAttribution compact />
            </View>
            <ThemedText style={{ marginBottom: 8, color: colors.text + '99' }}>
              {latitude && longitude
                ? `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`
                : 'Toca el mapa para seleccionar la ubicación'}
            </ThemedText>

            <FieldLabel
              title="Precio fijo o rango"
              status="optional"
              helperText="Si no se indica, se mostrará 'Consultar precios'."
            />
            <FieldLabel title="Precio fijo" status="choice" badgeText="Opción A" />
            <TextInput
              ref={precioRef}
              value={precio}
              onChangeText={setPrecio}
              placeholder="Ej: 15 €"
              keyboardType="numeric"
              placeholderTextColor={colors.text + '99'}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
              ]}
              returnKeyType="next"
              onSubmitEditing={() => precioMinRef.current?.focus()}
              blurOnSubmit={false}
            />

            <FieldLabel
              title="Precio mínimo"
              status="choice"
              badgeText="Opción B"
              helperText="Rellénalo junto con el precio máximo."
            />
            <TextInput
              ref={precioMinRef}
              value={precioMin}
              onChangeText={setPrecioMin}
              placeholder="Ej: 10 €"
              keyboardType="numeric"
              placeholderTextColor={colors.text + '99'}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
              ]}
              returnKeyType="next"
              onSubmitEditing={() => precioMaxRef.current?.focus()}
              blurOnSubmit={false}
            />

            <FieldLabel
              title="Precio máximo"
              status="choice"
              badgeText="Opción B"
              helperText="Rellénalo junto con el precio mínimo."
            />
            <TextInput
              ref={precioMaxRef}
              value={precioMax}
              onChangeText={setPrecioMax}
              placeholder="Ej: 25 €"
              keyboardType="numeric"
              placeholderTextColor={colors.text + '99'}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
              ]}
              returnKeyType="next"
              onSubmitEditing={Keyboard.dismiss}
              blurOnSubmit={false}
            />

            <FieldLabel title="Estado" status="automatic" />
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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <FieldLabel title="Recurrencia" status="optional" />
              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Recurrencia',
                    'Si el evento se repite periódicamente, selecciona cada cuánto. Se crearán eventos independientes de forma automática para cada repetición.'
                  )
                }
                style={{ marginLeft: 6, marginTop: 10 }}
              >
                <Icon name="information-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
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
                  {recurrenciaItems.find((i) => i.value === (recurrencia ?? ''))?.label ??
                    'Sin recurrencia'}
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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <FieldLabel title="Fecha fin de recurrencia" status="optional" />
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(
                        'Fecha fin de recurrencia',
                        'Última fecha en la que se generará una repetición del evento. La fecha indicada se incluye en la serie.'
                      )
                    }
                    style={{ marginLeft: 6, marginTop: 10 }}
                  >
                    <Icon name="information-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
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
            <FieldLabel title="Categoría" status="required" />
            {categoriasLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginBottom: 10 }} />
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
                      ? dropdownItems.find((i) => i.value === categoriaId)?.label ??
                        'Selecciona una categoría...'
                      : 'Selecciona una categoría...'}
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
            {privado && eventLinkAcceso && (
              <PrivateEventLinkModal
                visible={showPrivateLinkModal}
                linkAcceso={eventLinkAcceso}
                eventTitle={title}
                onClose={() => {
                  setShowPrivateLinkModal(false);
                  navigation.goBack();
                }}
              />
            )}
            <FieldLabel
              title="Imagen del evento"
              status="optional"
              helperText="Máximo 5 imágenes."
            />

            {localImageUris && localImageUris.length > 0 && (
              <View
                style={{ width: '100%', marginBottom: 8, position: 'relative', minHeight: 130 }}
                onLayout={(e) => setImageContainerWidth(e.nativeEvent.layout.width)}
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  directionalLockEnabled
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minWidth: '100%',
                  }}
                  style={{ width: '100%' }}
                  ref={imageScrollRef}
                  onContentSizeChange={(w) => setImageMaxScroll(w - imageContainerWidth)}
                  onScroll={(e) => setImageScrollX(e.nativeEvent.contentOffset.x)}
                  scrollEventThrottle={16}
                >
                  {localImageUris.map((uri, idx) => (
                    <View key={idx} style={{ marginRight: 8, position: 'relative' }}>
                      <Image
                        source={{ uri }}
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
                        onPress={() => removeImageAtIndex(idx)}
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
                              coverImageUrl === imageUrls[idx] ? colors.primary : 'rgba(0,0,0,0.6)',
                          },
                        ]}
                      >
                        <ThemedText style={{ color: '#fff', fontSize: 12 }}>
                          {coverImageUrl === imageUrls[idx] ? 'Portada' : 'Elegir portada'}
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
                {imageScrollX > 0 && (
                  <TouchableOpacity
                    onPress={() =>
                      imageScrollRef.current?.scrollTo({ x: imageScrollX - 130, animated: true })
                    }
                    style={styles.scrollArrowLeft}
                  >
                    <Icon name="chevron-left" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
                {imageMaxScroll > 0 && imageScrollX < imageMaxScroll && (
                  <TouchableOpacity
                    onPress={() =>
                      imageScrollRef.current?.scrollTo({ x: imageScrollX + 130, animated: true })
                    }
                    style={styles.scrollArrowRight}
                  >
                    <Icon name="chevron-right" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
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
              title={loading ? 'Creando...' : 'Crear Evento'}
              onPress={handleCreateEvent}
              disabled={loading}
              style={{ marginTop: 16 }}
            />
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  mapSearchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 15,
    marginRight: 8,
  },
  mapSearchButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    padding: 20,
    justifyContent: 'center',
  },
  requiredHint: {
    marginBottom: 12,
  },
  input: {
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
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
  scrollArrowLeft: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
    zIndex: 10,
  },
  scrollArrowRight: {
    position: 'absolute',
    right: 0,
    top: '50%',
    marginTop: -20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
    zIndex: 10,
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
});

export default CreateEventScreen;
