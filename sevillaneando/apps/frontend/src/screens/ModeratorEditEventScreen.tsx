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
import { RootStackParamList } from '../App';
import { ThemedView, ThemedText, ThemedTitle, ThemedButton, OsmAttribution } from '../components';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import DropDownPicker from 'react-native-dropdown-picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { StyleProp, ViewStyle } from 'react-native';
import DateTimePickerModalOriginal from 'react-native-modal-datetime-picker';
import { ComponentType } from 'react';

const DateTimePickerModal = DateTimePickerModalOriginal as unknown as ComponentType<any>;

type Props = NativeStackScreenProps<RootStackParamList, 'ModeratorEditEvent'>;
type Categoria = { id: string; nombre: string };

export const ModeratorEditEventScreen: React.FC<Props> = ({ route, navigation }) => {
  const { event } = route.params;
  const isPrivateEvent = Boolean(event.privado);
  const mapRef = useRef<any>(null);
  const { colors } = useTheme();

  const ArrowUpIcon = ({ style }: { style?: StyleProp<ViewStyle> }) => (
    <Icon name="chevron-up" size={24} color={colors.text} style={(style || {}) as ViewStyle} />
  );
  const ArrowDownIcon = ({ style }: { style?: StyleProp<ViewStyle> }) => (
    <Icon name="chevron-down" size={24} color={colors.text} style={(style || {}) as ViewStyle} />
  );
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [address, setAddress] = useState(event.address);
  const [fechaInicio, setFechaInicio] = useState(event.fechaInicio);
  const [fechaFin, setFechaFin] = useState(event.fechaFin);
  const [showFechaInicio, setShowFechaInicio] = useState(false);
  const [showHoraInicio, setShowHoraInicio] = useState(false);
  const [showFechaFin, setShowFechaFin] = useState(false);
  const [showHoraFin, setShowHoraFin] = useState(false);
  const [latitude, setLatitude] = useState(event.location?.coordinates[1] ?? 37.3891);
  const [longitude, setLongitude] = useState(event.location?.coordinates[0] ?? -5.9845);
  const [mapDelta, setMapDelta] = useState({ latitudeDelta: 0.01, longitudeDelta: 0.01 });
  const [precio, setPrecio] = useState(String(event.precio ?? ''));
  const [precioMin, setPrecioMin] = useState(String(event.precioMin ?? ''));
  const [precioMax, setPrecioMax] = useState(String(event.precioMax ?? ''));
  const [categoriaId, setCategoriaId] = useState(event.categoria?.id ?? '');
  const [openCategoria, setOpenCategoria] = useState(false);
  const [dropdownItems, setDropdownItems] = useState<{ label: string; value: string }[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>(event.imagenes ?? []);
  const [localImageUris, setLocalImageUris] = useState<string[]>(event.imagenes ?? []);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(event.imagen ?? (event.imagenes?.[0] ?? null));
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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5 - imageUrls.length,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newUris = result.assets.map(asset => asset.uri).slice(0, 5 - imageUrls.length);
      const urls: string[] = [];
      for (const uri of newUris) {
        const formData = new FormData();
        formData.append('file', {
          uri,
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
          urls.push(url);
        } catch (e) {
          Alert.alert('Error', 'No se pudo subir una imagen.');
        }
      }
      setLocalImageUris(prev => [...prev, ...newUris]);
      setImageUrls(prev => {
        const combined = [...prev, ...urls];
        if (!coverImageUrl && combined.length > 0) setCoverImageUrl(combined[0]);
        return combined;
      });
      if (!coverImageUrl && urls.length > 0) setCoverImageUrl(urls[0]);
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
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setLatitude(lat);
        setLongitude(lon);
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
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      );
      const data = await response.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
      }
    } catch (e) {
      // Comentario para la guia de estilo
    }
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
    if (
      !title ||
      !description ||
      !address ||
      !fechaInicio ||
      !fechaFin ||
      latitude === null ||
      longitude === null ||
      !categoriaId
    ) {
      Alert.alert('Error', 'Asegúrate de completar todos los campos obligatorios.');
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
        precio: precio && precio.trim() !== '' ? parseFloat(precio) : null,
        precioMin: precioMin && precioMin.trim() !== '' ? parseFloat(precioMin) : null,
        precioMax: precioMax && precioMax.trim() !== '' ? parseFloat(precioMax) : null,
        categoriaId,
        estado,
        imagenes: imageUrls || undefined,
        imagen: coverImageUrl || undefined,
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
            <ThemedText style={styles.label}>Título</ThemedText>
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
            <ThemedText style={styles.label}>Descripción</ThemedText>
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
              initialRegion={{ latitude, longitude, ...mapDelta }}
              region={{ latitude, longitude, ...mapDelta }}
              onPress={(e: MapPressEvent) => {
                setLatitude(e.nativeEvent.coordinate.latitude);
                setLongitude(e.nativeEvent.coordinate.longitude);
              }}
            >
              <UrlTile
                urlTemplate="http://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maximumZ={19}
              />
              <Marker coordinate={{ latitude, longitude }} />
            </MapView>
            <View style={{ marginBottom: 8 }}>
              <OsmAttribution compact />
            </View>
            <ThemedText style={styles.label}>Fecha de inicio</ThemedText>
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
            <DateTimePickerModal
              isVisible={showFechaInicio}
              mode="date"
              date={fechaInicio ? new Date(fechaInicio) : new Date()}
              onConfirm={(date: Date) => {
                const prev = fechaInicio ? dayjs(fechaInicio) : dayjs();
                const nuevaFecha = dayjs(date).hour(prev.hour()).minute(prev.minute());
                setFechaInicio(nuevaFecha.format('YYYY-MM-DD HH:mm'));
                setShowFechaInicio(false);
                setShowHoraInicio(false);
                setTimeout(() => setShowHoraInicio(true), 350);
              }}
              onCancel={() => setShowFechaInicio(false)}
              minimumDate={new Date()}
              locale="es"
            />
            <DateTimePickerModal
              isVisible={showHoraInicio}
              mode="time"
              date={fechaInicio ? new Date(fechaInicio) : new Date()}
              onConfirm={(date: Date) => {
                const prev = fechaInicio ? dayjs(fechaInicio) : dayjs();
                const nuevaFecha = prev.hour(dayjs(date).hour()).minute(dayjs(date).minute());
                setFechaInicio(nuevaFecha.format('YYYY-MM-DD HH:mm'));
                setShowHoraInicio(false);
              }}
              onCancel={() => setShowHoraInicio(false)}
              locale="es"
            />
            <ThemedText style={styles.label}>Fecha de fin</ThemedText>
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
            <DateTimePickerModal
              isVisible={showFechaFin}
              mode="date"
              date={fechaFin ? new Date(fechaFin) : new Date()}
              onConfirm={(date: Date) => {
                const prev = fechaFin ? dayjs(fechaFin) : dayjs();
                const nuevaFecha = dayjs(date).hour(prev.hour()).minute(prev.minute());
                setFechaFin(nuevaFecha.format('YYYY-MM-DD HH:mm'));
                setShowFechaFin(false);
                setShowHoraFin(false);
                setTimeout(() => setShowHoraFin(true), 350);
              }}
              onCancel={() => setShowFechaFin(false)}
              minimumDate={
                fechaInicio && new Date(fechaInicio) > new Date()
                  ? new Date(fechaInicio)
                  : new Date()
              }
              locale="es"
            />
            <DateTimePickerModal
              isVisible={showHoraFin}
              mode="time"
              date={fechaFin ? new Date(fechaFin) : new Date()}
              onConfirm={(date: Date) => {
                const prev = fechaFin ? dayjs(fechaFin) : dayjs();
                const nuevaFecha = prev.hour(dayjs(date).hour()).minute(dayjs(date).minute());
                setFechaFin(nuevaFecha.format('YYYY-MM-DD HH:mm'));
                setShowHoraFin(false);
              }}
              onCancel={() => setShowHoraFin(false)}
              locale="es"
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
              Elige UNO: o un precio fijo, o un rango (mín-máx), o déjalo vacío para gratis
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
              <DropDownPicker
                open={openCategoria}
                value={categoriaId}
                items={dropdownItems}
                setOpen={setOpenCategoria}
                setValue={setCategoriaId}
                setItems={setDropdownItems}
                placeholder="Selecciona una categoría"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.primary,
                  minHeight: 40,
                  borderRadius: 8,
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
                minHeight: 40,
                borderRadius: 8,
              }}
              dropDownContainerStyle={{
                backgroundColor: colors.card,
                borderColor: colors.primary,
              }}
              textStyle={{ color: colors.text }}
              placeholderStyle={{ color: colors.text + '99' }}
              zIndex={900}
              listMode="SCROLLVIEW"
              ArrowUpIconComponent={ArrowUpIcon}
              ArrowDownIconComponent={ArrowDownIcon}
            />
            <ThemedText style={styles.label}>Imagen del evento</ThemedText>
            <TouchableOpacity style={styles.imagePicker}>
              {localImageUris && localImageUris.length > 0 ? (
                <>
                  <View style={{ width: '100%', marginBottom: 8, position: 'relative', minHeight: 130 }}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={true}
                      contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', minWidth: '100%' }}
                      style={{ width: '100%' }}
                      scrollEnabled={true}
                      ref={scrollRef}
                      onContentSizeChange={(w, h) => setMaxScroll(w - 360)}
                      onScroll={e => {
                        setScrollX(e.nativeEvent.contentOffset.x);
                      }}
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
                                borderColor: coverImageUrl === imageUrls[idx] ? colors.primary : 'transparent',
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
                              if (newUrls.length === 0) {
                                setCoverImageUrl(null);
                              } else if (coverImageUrl === imageUrls[idx]) {
                                setCoverImageUrl(newUrls[0] || null);
                              }
                            }}
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              backgroundColor: 'rgba(0,0,0,0.6)',
                              borderRadius: 12,
                              padding: 2,
                              zIndex: 2,
                            }}
                          >
                            <Icon name="close" size={18} color="#fff" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setCoverImageUrl(imageUrls[idx])}
                            style={{
                              position: 'absolute',
                              bottom: 4,
                              left: 4,
                              backgroundColor: coverImageUrl === imageUrls[idx] ? colors.primary : 'rgba(0,0,0,0.6)',
                              borderRadius: 12,
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              zIndex: 2,
                            }}
                          >
                            <ThemedText style={{ color: '#fff', fontSize: 12 }}>
                              {coverImageUrl === imageUrls[idx] ? 'Portada' : 'Elegir portada'}
                            </ThemedText>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                    {imageUrls.length > 2 && maxScroll > 20 && scrollX < maxScroll - 10 && (
                      <TouchableOpacity
                        onPress={() => {
                          if (scrollRef.current) {
                            scrollRef.current.scrollTo({ x: scrollX + 200, animated: true });
                          }
                        }}
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: '50%',
                          transform: [{ translateY: -20 }],
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          borderRadius: 20,
                          padding: 6,
                          zIndex: 10,
                        }}
                      >
                        <Icon name="chevron-right" size={28} color="#fff" />
                      </TouchableOpacity>
                    )}
                    {imageUrls.length > 2 && maxScroll > 20 && scrollX > 10 && (
                      <TouchableOpacity
                        onPress={() => {
                          if (scrollRef.current) {
                            scrollRef.current.scrollTo({ x: scrollX - 200, animated: true });
                          }
                        }}
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '50%',
                          transform: [{ translateY: -20 }],
                          backgroundColor: 'rgba(0,0,0,0.3)',
                          borderRadius: 20,
                          padding: 6,
                          zIndex: 10,
                        }}
                      >
                        <Icon name="chevron-left" size={28} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                  {imageUrls.length < 5 && (
                    <ThemedButton
                      title="Añadir más imágenes"
                      onPress={pickImages}
                      style={{ marginBottom: 8, alignSelf: 'flex-start' }}
                    />
                  )}
                </>
              ) : (
                <>
                  <ThemedButton
                    title="Añadir imágenes"
                    onPress={pickImages}
                    style={{ marginBottom: 8, alignSelf: 'flex-start' }}
                  />
                </>

              )}
            </TouchableOpacity>
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
  input: { borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 8, borderColor: '#ccc' },
  map: { width: '100%', height: 180, borderRadius: 10, marginBottom: 12 },
  mapSearchInput: {
    borderWidth: 1,
    borderRadius: 8,
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
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  imagePreview: { width: 180, height: 120, borderRadius: 10, marginBottom: 8 },
  removeImageBtn: { backgroundColor: '#f44336', padding: 6, borderRadius: 6 },
  imagePicker: {
    alignSelf: 'center',
    marginBottom: 16,
    width: '100%',
  },
});

export default ModeratorEditEventScreen;
