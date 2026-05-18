import React, { useState, useRef, useEffect } from 'react';
import dayjs from 'dayjs';
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
import MapView, { Marker, UrlTile, MapPressEvent } from 'react-native-maps';
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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePickerModalOriginal from 'react-native-modal-datetime-picker';
import { ComponentType } from 'react';
import { CalendarDateTimePicker } from '../components';
import { getFullImageUrl, getImageUrlCandidates } from '../utils/imageUrl';
import { OSM_TILE_URL_TEMPLATE, SEVILLE_COORDINATES } from '../utils/map';
import { toBackendDateTime } from '../utils/dateTime';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

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
  const [imageContainerWidth, setImageContainerWidth] = useState(0);
  const [mapActive, setMapActive] = useState(false);

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
        Alert.alert(t('createEvent.addressNotFound'), t('createEvent.addressNotFoundMsg'));
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('createEvent.addressError'));
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
    setLoading(true);
    let payload: any;
    try {
      const precioVal = precio && precio.trim() !== '' ? parseFloat(precio) : null;
      const precioMinVal = precioMin && precioMin.trim() !== '' ? parseFloat(precioMin) : null;
      const precioMaxVal = precioMax && precioMax.trim() !== '' ? parseFloat(precioMax) : null;
      payload = {
        title,
        description,
        address,
        fechaInicio: toBackendDateTime(fechaInicio ?? ''),
        fechaFin: toBackendDateTime(fechaFin ?? ''),
        location: { type: 'Point', coordinates: [longitude, latitude] },
        ...(precioVal != null ? { precio: precioVal } : {}),
        ...(precioMinVal != null ? { precioMin: precioMinVal } : {}),
        ...(precioMaxVal != null ? { precioMax: precioMaxVal } : {}),
        categoriaId,
        estado,
        imagenes: imageUrls || undefined,
        imagen: coverImageUrl || undefined,
        recurrencia: recurrencia || undefined,
        recurrenciaFin: recurrenciaFin || undefined,
      };
      await api.put(`/events/${event.id}`, payload);
      Alert.alert(t('common.success'), t('moderatorEditEvent.eventUpdated'));
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
  };

  const handleDeleteEvent = () => {
    Alert.alert(t('moderatorEditEvent.deleteEvent'), t('moderatorEditEvent.deleteMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await api.delete(`/events/${event.id}`);
            Alert.alert(t('userEditEvent.deleteSuccess'), t('userEditEvent.deleteSuccessMsg'));
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
          <ThemedTitle style={{ marginBottom: 16 }}>{t('userEditEvent.title')}</ThemedTitle>
          <ThemedTextSecondary style={styles.requiredHint}>
            {t('moderatorEditEvent.requiredHint')}
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
          <FieldLabel title="Dirección" status="required" />
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
          <FieldLabel title="Buscar dirección o lugar" status="optional" />
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
          <FieldLabel title="Ubicación en el mapa" status="required" />
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              initialRegion={{
                latitude,
                longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={mapActive}
              zoomEnabled={mapActive}
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
            value={fechaInicio ?? ''}
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
            value={fechaFin ?? ''}
            minimumDate={fechaInicio ? new Date(fechaInicio) : undefined}
            onConfirm={(val) => {
              setFechaFin(val);
              setShowFechaFin(false);
            }}
            onCancel={() => setShowFechaFin(false)}
          />

          <FieldLabel title="Privado" status="readonly" />
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
              {t('moderatorEditEvent.readOnly')}
            </ThemedText>
          </TouchableOpacity>

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
            placeholder="Ej: 25€"
            placeholderTextColor={colors.text + '99'}
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary },
            ]}
            keyboardType="numeric"
          />

          <FieldLabel title="Categoría" status="required" />
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
                    ? dropdownItems.find((i) => i.value === categoriaId)?.label ??
                      'Selecciona una categoría'
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
          <FieldLabel title="Estado de moderación" status="required" />
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
          <ThemedButton
            title={loading ? t('moderatorEditEvent.saving') : t('moderatorEditEvent.saveChanges')}
            onPress={handleSave}
            disabled={loading}
          />
          <TouchableOpacity
            style={[styles.deleteEventButton, { borderColor: '#d32f2f' }]}
            onPress={handleDeleteEvent}
            disabled={loading}
          >
            <Icon name="trash-can-outline" size={20} color="#d32f2f" />
            <ThemedText style={styles.deleteEventText}>
              {t('moderatorEditEvent.deleteEvent')}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  scrollContainer: { flexGrow: 1 },
  requiredHint: { marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 16, padding: 8, marginBottom: 8, borderColor: '#ccc' },
  map: { width: '100%', height: 180, borderRadius: 10, marginBottom: 12 },
  mapContainer: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
    position: 'relative',
  },
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
  removeImageBtn: { backgroundColor: '#f44336', padding: 6, borderRadius: 12 },
});

export default ModeratorEditEventScreen;
