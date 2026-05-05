import React, { useState, useRef, useEffect } from 'react';
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
} from '../components';
import { useTheme } from '../hooks/useTheme';
import { api, API_BASE_URL, getErrorMessage } from '../services';
import { useAuth } from '../hooks/useAuth';
import DropDownPicker from 'react-native-dropdown-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';
import { StyleProp, ViewStyle } from 'react-native';
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

  const ArrowUpIcon = ({ style }: { style?: StyleProp<ViewStyle> }) => (
    <Icon name="chevron-up" size={24} color={colors.text} style={(style || {}) as ViewStyle} />
  );
  const ArrowDownIcon = ({ style }: { style?: StyleProp<ViewStyle> }) => (
    <Icon name="chevron-down" size={24} color={colors.text} style={(style || {}) as ViewStyle} />
  );

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

  const buildCreateEventPayload = () => ({
    title,
    description,
    address,
    fechaInicio: toBackendDateTime(fechaInicio),
    fechaFin: toBackendDateTime(fechaFin),
    location: {
      type: 'Point' as const,
      coordinates: [longitude, latitude],
    },
    precio: parseOptionalNumber(precio),
    precioMin: parseOptionalNumber(precioMin),
    precioMax: parseOptionalNumber(precioMax),
    privado,
    categoriaId,
    creadorId: user?.id,
    imagenes: imageUrls || undefined,
    imagen: coverImageUrl || undefined,
    recurrencia: recurrencia || undefined,
    recurrenciaFin: recurrenciaFin || undefined,
  });

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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
        >
          <ThemedView style={styles.container}>
            <ThemedTitle style={{ marginBottom: 16 }}>Crear Evento</ThemedTitle>
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
              onSubmitEditing={Keyboard.dismiss}
              blurOnSubmit={false}
            />

            <ThemedText style={styles.label}>Fecha de inicio (opcional)</ThemedText>
            <ThemedTextSecondary style={{ marginBottom: 8 }}>
              Si no la indicas, el evento se publicará sin fecha y podrás añadirla más tarde.
            </ThemedTextSecondary>
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
            <ThemedText style={styles.label}>Fecha de fin (opcional)</ThemedText>
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
                  style={{ color: address ? colors.text : colors.text + '99', fontSize: 16 }}
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
                  latitudeDelta: DEFAULT_MAP_DELTA.latitudeDelta,
                  longitudeDelta: DEFAULT_MAP_DELTA.longitudeDelta,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
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
            </View>
            <View style={{ marginBottom: 8 }}>
              <OsmAttribution compact />
            </View>
            <ThemedText style={{ marginBottom: 8, color: colors.text + '99' }}>
              {latitude && longitude
                ? `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`
                : 'Toca el mapa para seleccionar la ubicación'}
            </ThemedText>

            <ThemedText style={styles.label}>Precio: Fijo o Intervalo</ThemedText>
            <ThemedText style={{ fontSize: 12, color: colors.text + '77', marginBottom: 8 }}>
              Elige UNO: precio fijo (0 € = gratis) o un rango mín-máx. Campo obligatorio.
            </ThemedText>

            <ThemedText style={styles.label}>Precio Fijo</ThemedText>
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

            <ThemedText style={styles.label}>Precio Mínimo</ThemedText>
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

            <ThemedText style={styles.label}>Precio Máximo</ThemedText>
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

            <ThemedText style={styles.label}>Estado</ThemedText>
            <DropDownPicker
              open={openEstado}
              value={estado}
              items={estadoItems}
              setOpen={setOpenEstado}
              setValue={setEstado}
              setItems={setEstadoItems}
              placeholder="Selecciona un estado"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.primary,
                minHeight: 48,
                borderRadius: 16,
                marginBottom: 10,
              }}
              dropDownContainerStyle={{
                backgroundColor: colors.card,
                borderColor: colors.primary,
              }}
              textStyle={{ color: colors.text, fontSize: 15 }}
              placeholderStyle={{ color: colors.text + '80' }}
              listMode="MODAL"
              modalProps={{ animationType: 'fade', style: { margin: 0 } }}
              modalContentContainerStyle={{
                backgroundColor: colors.card,
                borderRadius: 20,
                paddingVertical: 8,
                marginHorizontal: 24,
                marginVertical: 'auto',
                maxHeight: '60%',
                alignSelf: 'center',
                width: '90%',
              }}
              modalTitle="Estado"
              modalTitleStyle={{ color: colors.text, fontWeight: '700', fontSize: 17 }}
              selectedItemContainerStyle={{ backgroundColor: colors.primary + '22' }}
              selectedItemLabelStyle={{ color: colors.primary, fontWeight: '600' }}
              itemSeparator
              itemSeparatorStyle={{ backgroundColor: colors.border ?? colors.text + '15' }}
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
                minHeight: 48,
                borderRadius: 16,
                marginBottom: 10,
              }}
              dropDownContainerStyle={{
                backgroundColor: colors.card,
                borderColor: colors.primary,
              }}
              textStyle={{ color: colors.text, fontSize: 15 }}
              placeholderStyle={{ color: colors.text + '80' }}
              listMode="MODAL"
              modalProps={{ animationType: 'fade', style: { margin: 0 } }}
              modalContentContainerStyle={{
                backgroundColor: colors.card,
                borderRadius: 20,
                paddingVertical: 8,
                marginHorizontal: 24,
                marginVertical: 'auto',
                maxHeight: '60%',
                alignSelf: 'center',
                width: '90%',
              }}
              modalTitle="Recurrencia"
              modalTitleStyle={{ color: colors.text, fontWeight: '700', fontSize: 17 }}
              selectedItemContainerStyle={{ backgroundColor: colors.primary + '22' }}
              selectedItemLabelStyle={{ color: colors.primary, fontWeight: '600' }}
              itemSeparator
              itemSeparatorStyle={{ backgroundColor: colors.border ?? colors.text + '15' }}
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
                  minHeight: 48,
                  borderRadius: 16,
                  marginBottom: 10,
                }}
                dropDownContainerStyle={{
                  backgroundColor: colors.card,
                  borderColor: colors.primary,
                }}
                textStyle={{ color: colors.text, fontSize: 15 }}
                placeholderStyle={{ color: colors.text + '80' }}
                listMode="MODAL"
                modalProps={{ animationType: 'fade' }}
                modalContentContainerStyle={{
                  backgroundColor: colors.card,
                  borderRadius: 20,
                  paddingVertical: 8,
                  marginHorizontal: 16,
                }}
                modalTitle="Categoría"
                modalTitleStyle={{ color: colors.text, fontWeight: '700', fontSize: 17 }}
                selectedItemContainerStyle={{ backgroundColor: colors.primary + '22' }}
                selectedItemLabelStyle={{ color: colors.primary, fontWeight: '600' }}
                itemSeparator
                itemSeparatorStyle={{ backgroundColor: colors.border ?? colors.text + '15' }}
                ArrowUpIconComponent={ArrowUpIcon}
                ArrowDownIconComponent={ArrowDownIcon}
              />
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
  label: {
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 2,
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
