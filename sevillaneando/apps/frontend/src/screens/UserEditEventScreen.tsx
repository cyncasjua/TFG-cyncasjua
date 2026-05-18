import { PrivateEventLinkModal } from '../components';
import React, { useState, useRef, useEffect, ComponentType } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
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
import { api, API_BASE_URL } from '../services';
import { useAuth } from '../hooks/useAuth';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import dayjs from 'dayjs';
import DateTimePickerModalOriginal from 'react-native-modal-datetime-picker';
import { CalendarDateTimePicker } from '../components';
import { reportWarning } from '../utils/telemetry';
import { getFullImageUrl, getImageUrlCandidates } from '../utils/imageUrl';
import { OSM_TILE_URL_TEMPLATE, SEVILLE_COORDINATES } from '../utils/map';
import { toBackendDateTime } from '../utils/dateTime';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const [showPrivateLinkModal, setShowPrivateLinkModal] = useState(false);
  const [eventLinkAcceso, setEventLinkAcceso] = useState<string | null>(null);

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

  const [precio, setPrecio] = useState(event.precio != null ? String(event.precio) : '');
  const [precioMin, setPrecioMin] = useState(
    event.precioMin != null ? String(event.precioMin) : ''
  );
  const [precioMax, setPrecioMax] = useState(
    event.precioMax != null ? String(event.precioMax) : ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  const [categoriaId, setCategoriaId] = useState<string | null>(event.categoria?.id ?? null);
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
  const [imageContainerWidth, setImageContainerWidth] = useState(0);
  const [mapActive, setMapActive] = useState(false);

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
        Alert.alert(t('common.error'), t('createEvent.noCategoriesError'));
      } finally {
        setCategoriasLoading(false);
      }
    };
    fetchCategorias();
  }, [t]);

  const pickImages = async () => {
    const remainingSlots = 5 - imageUrls.length;
    if (remainingSlots <= 0) {
      Alert.alert(t('createEvent.limitReached'), t('createEvent.maxImagesMsg'));
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
          Alert.alert(t('common.error'), t('createEvent.imageUploadError'));
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
        Alert.alert(t('createEvent.addressNotFound'), t('createEvent.addressNotFoundMsg'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('createEvent.addressError'));
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
      Alert.alert(t('common.error'), t('createEvent.requiredFieldsMsg'));
      return;
    }
    const precioVal = precio.trim() !== '' ? parseFloat(precio) : null;
    const precioMinVal = precioMin.trim() !== '' ? parseFloat(precioMin) : null;
    const precioMaxVal = precioMax.trim() !== '' ? parseFloat(precioMax) : null;
    const rangoIncompleto = (precioMinVal !== null) !== (precioMaxVal !== null);
    const conflicto = precioVal !== null && (precioMinVal !== null || precioMaxVal !== null);
    if (rangoIncompleto) {
      Alert.alert(t('common.error'), t('createEvent.priceRangeError'));
      return;
    }
    if (conflicto) {
      Alert.alert(t('common.error'), t('createEvent.priceConflict'));
      return;
    }
    if (!user?.id) {
      Alert.alert(t('common.error'), t('createEvent.noUserError'));
      return;
    }

    setLoading(true);
    try {
      const precioVal = precio && precio.trim() !== '' ? parseFloat(precio) : null;
      const precioMinVal = precioMin && precioMin.trim() !== '' ? parseFloat(precioMin) : null;
      const precioMaxVal = precioMax && precioMax.trim() !== '' ? parseFloat(precioMax) : null;
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
        ...(precioVal != null ? { precio: precioVal } : {}),
        ...(precioMinVal != null ? { precioMin: precioMinVal } : {}),
        ...(precioMaxVal != null ? { precioMax: precioMaxVal } : {}),
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
        Alert.alert(t('common.success'), t('userEditEvent.updateSuccess'));
        if (onEventEdited) onEventEdited();
        navigation.goBack();
      }
    } catch (error: any) {
      let msg = t('userEditEvent.updateError');
      if (error?.response?.data?.message) {
        msg = error.response.data.message;
      } else if (error?.message) {
        msg = error.message;
      }
      Alert.alert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = () => {
    Alert.alert(t('userEditEvent.deleteEvent'), t('userEditEvent.deleteEventMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await api.delete(`/events/${event.id}`);
            Alert.alert(t('userEditEvent.deleteSuccess'), t('userEditEvent.deleteSuccessMsg'));
            if (onEventEdited) onEventEdited();
            navigation.goBack();
          } catch (error: any) {
            let msg = t('userEditEvent.updateError');
            if (error?.response?.data?.message) {
              msg = error.response.data.message;
            } else if (error?.message) {
              msg = error.message;
            }
            Alert.alert(t('common.error'), msg);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
        scrollEnabled={!mapActive}
        onScrollBeginDrag={Keyboard.dismiss}
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
          <ThemedTitle style={{ marginBottom: 16 }}>{t('userEditEvent.title')}</ThemedTitle>

          <ThemedTextSecondary style={styles.requiredHint}>
            {t('userEditEvent.requiredHint')}
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
            onSubmitEditing={() => addressRef.current?.focus()}
            blurOnSubmit={false}
          />

          <FieldLabel title="Fecha de inicio" status="optional" />
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
            onConfirm={(val) => {
              setFechaInicio(val);
              setShowFechaInicio(false);
            }}
            onCancel={() => setShowFechaInicio(false)}
          />

          <FieldLabel title="Fecha de fin" status="optional" />
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
            minimumDate={fechaInicio ? new Date(fechaInicio) : undefined}
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
              scrollEnabled={mapActive}
              zoomEnabled={mapActive}
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
            <Pressable
              onPress={() => setMapActive((v) => !v)}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderRadius: 20,
                width: 36,
                height: 36,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Icon name={mapActive ? 'lock-open-variant' : 'lock'} size={18} color="#fff" />
            </Pressable>
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
            placeholder="Precio fijo si no usas rango (Ej: 15)"
            keyboardType="numeric"
            placeholderTextColor={colors.text + '99'}
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
            ]}
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
            placeholder="Precio mínimo si usas rango (Ej: 10)"
            keyboardType="numeric"
            placeholderTextColor={colors.text + '99'}
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
            ]}
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
            placeholder="Precio máximo si usas rango (Ej: 25)"
            keyboardType="numeric"
            placeholderTextColor={colors.text + '99'}
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
            ]}
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
            <FieldLabel title={t('createEvent.recurrence')} status="optional" />
            <TouchableOpacity
              onPress={() =>
                Alert.alert(t('createEvent.recurrence'), t('createEvent.recurrenceHint'))
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
                  t('createEvent.noRecurrence')}
              </ThemedText>
              <Icon name="chevron-down" size={22} color={colors.text} />
            </TouchableOpacity>
            <AppPickerModal
              visible={openRecurrencia}
              title={t('createEvent.recurrence')}
              items={recurrenciaItems}
              value={recurrencia ?? ''}
              onSelect={(val) => setRecurrencia(val || null)}
              onClose={() => setOpenRecurrencia(false)}
            />
          </>
          {!!recurrencia && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <FieldLabel title={t('createEvent.recurrenceEnd')} status="optional" />
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(t('createEvent.recurrenceEnd'), t('createEvent.recurrenceEndHint'))
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
                    : t('createEvent.selectEndDate')}
                </ThemedText>
              </TouchableOpacity>
              <DateTimePickerModal
                isVisible={showRecurrenciaFin}
                mode="date"
                minimumDate={fechaInicio ? new Date(fechaInicio) : undefined}
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

          <FieldLabel title="Imagen del evento" status="optional" helperText="Máximo 5 imágenes." />

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
                ref={scrollRef}
                onContentSizeChange={(w) => setMaxScroll(w - imageContainerWidth)}
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
                              coverImageUrl === imageUrls[idx] ? colors.primary : 'rgba(0,0,0,0.6)',
                          },
                        ]}
                      >
                        <ThemedText style={{ color: '#fff', fontSize: 12 }}>
                          {coverImageUrl === imageUrls[idx]
                            ? t('createEvent.cover')
                            : t('createEvent.chooseCover')}
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
              {scrollX > 0 && (
                <TouchableOpacity
                  onPress={() => scrollRef.current?.scrollTo({ x: scrollX - 130, animated: true })}
                  style={styles.scrollArrowLeft}
                >
                  <Icon name="chevron-left" size={24} color="#fff" />
                </TouchableOpacity>
              )}
              {maxScroll > 0 && scrollX < maxScroll && (
                <TouchableOpacity
                  onPress={() => scrollRef.current?.scrollTo({ x: scrollX + 130, animated: true })}
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
                {t('createEvent.addImages')}
              </ThemedText>
            </TouchableOpacity>
          )}

          <View style={{ marginTop: 24 }}>
            <ThemedButton
              title={loading ? t('common.sending') : t('moderatorEditEvent.saveChanges')}
              onPress={handleEditEvent}
              disabled={loading}
            />
          </View>
          <TouchableOpacity
            style={[styles.deleteEventButton, { borderColor: '#d32f2f' }]}
            onPress={handleDeleteEvent}
            disabled={loading}
          >
            <Icon name="trash-can-outline" size={20} color="#d32f2f" />
            <ThemedText style={styles.deleteEventText}>{t('userEditEvent.deleteEvent')}</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
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
  requiredHint: {
    marginBottom: 12,
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
  deleteEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    marginTop: 12,
    gap: 8,
  },
  deleteEventText: {
    color: '#d32f2f',
    fontWeight: 'bold',
  },
});
