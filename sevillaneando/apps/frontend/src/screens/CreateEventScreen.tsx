import React, { useState, useRef, useEffect } from 'react';
import { Alert, StyleSheet, KeyboardAvoidingView, Platform, TextInput, ScrollView, Keyboard, TouchableOpacity, Image, View, Button, TouchableWithoutFeedback, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { ThemedView, ThemedText, ThemedTitle, ThemedButton } from '../components';
import { useTheme } from '../hooks/useTheme';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DropDownPicker from 'react-native-dropdown-picker';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateEvent'>;

type Categoria = {
  id: string;
  nombre: string;
};

export const CreateEventScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [precio, setPrecio] = useState('');
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriasLoading, setCategoriasLoading] = useState(true);

  const descriptionRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const fechaInicioRef = useRef<TextInput>(null);
  const fechaFinRef = useRef<TextInput>(null);
  const latitudeRef = useRef<TextInput>(null);
  const longitudeRef = useRef<TextInput>(null);
  const precioRef = useRef<TextInput>(null);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  const categoriaItems = categorias.map((cat) => ({
    label: cat.nombre,
    value: cat.id,
  }));

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
            headers: {
              'Content-Type': 'multipart/form-data',
            },
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

  const handleCreateEvent = async () => {
    if (
      !title ||
      !description ||
      !address ||
      !fechaInicio ||
      !fechaFin ||
      !latitude ||
      !longitude ||
      !precio ||
      !categoriaId
    ) {
      Alert.alert('Error', 'Por favor, completa todos los campos obligatorios.');
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
        fechaInicio,
        fechaFin,
        location: {
          type: 'Point',
          coordinates: [parseFloat(latitude), parseFloat(longitude)],
        },
        precio: parseFloat(precio),
        categoriaId,
        creadorId: user.id,
        imagen: imageUrl || undefined,
      };
      console.log('Payload para crear evento:', payload);
      await api.post('/events', payload);
      Alert.alert('Éxito', 'Evento enviado para revisión. Será visible tras la aprobación de un moderador.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear el evento.');
      if (
        error &&
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        (error as any).response &&
        'data' in (error as any).response
      ) {
        console.log('Error al crear evento:', (error as any).response.data);
      } else {
        console.log('Error al crear evento:', error);
      }
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
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled"  nestedScrollEnabled={true}>
          <ThemedView style={styles.container}>
            <ThemedTitle style={{ marginBottom: 16 }}>Crear Evento</ThemedTitle>
            <ThemedText style={styles.label}>Título</ThemedText>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Título del evento"
              placeholderTextColor={colors.text + '99'}
              style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]}
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
              style={[styles.input, { height: 80, color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]}
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
              style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]}
              returnKeyType="next"
              onSubmitEditing={() => fechaInicioRef.current?.focus()}
              blurOnSubmit={false}
            />
            <ThemedText style={styles.label}>Fecha de inicio</ThemedText>
            <TextInput
              ref={fechaInicioRef}
              value={fechaInicio}
              onChangeText={setFechaInicio}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.text + '99'}
              style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]}
              returnKeyType="next"
              onSubmitEditing={() => fechaFinRef.current?.focus()}
              blurOnSubmit={false}
            />
            <ThemedText style={styles.label}>Fecha de fin</ThemedText>
            <TextInput
              ref={fechaFinRef}
              value={fechaFin}
              onChangeText={setFechaFin}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.text + '99'}
              style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]}
              returnKeyType="next"
              onSubmitEditing={() => latitudeRef.current?.focus()}
              blurOnSubmit={false}
            />
            <ThemedText style={styles.label}>Latitud</ThemedText>
            <TextInput
              ref={latitudeRef}
              value={latitude}
              onChangeText={setLatitude}
              placeholder="Latitud"
              keyboardType="numeric"
              placeholderTextColor={colors.text + '99'}
              style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]}
              returnKeyType="next"
              onSubmitEditing={() => longitudeRef.current?.focus()}
              blurOnSubmit={false}
            />
            <ThemedText style={styles.label}>Longitud</ThemedText>
            <TextInput
              ref={longitudeRef}
              value={longitude}
              onChangeText={setLongitude}
              placeholder="Longitud"
              keyboardType="numeric"
              placeholderTextColor={colors.text + '99'}
              style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]}
              returnKeyType="next"
              onSubmitEditing={() => precioRef.current?.focus()}
              blurOnSubmit={false}
            />
            <ThemedText style={styles.label}>Precio</ThemedText>
            <TextInput
              ref={precioRef}
              value={precio}
              onChangeText={setPrecio}
              placeholder="Precio"
              keyboardType="numeric"
              placeholderTextColor={colors.text + '99'}
              style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.primary }]}
              returnKeyType="next"
              onSubmitEditing={Keyboard.dismiss}
              blurOnSubmit={false}
            />
            <ThemedText style={styles.label}>Categoría</ThemedText>
            {categoriasLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginBottom: 10 }} />
            ) : (
              <DropDownPicker
                open={open}
                setOpen={setOpen}
                value={categoriaId}
                setValue={setCategoriaId}
                items={categoriaItems}
                placeholder="Selecciona una categoría..."
                style={{
                  borderColor: colors.primary,
                  backgroundColor: colors.card,
                  marginBottom: 10,
                  zIndex: 1000,
                }}
                textStyle={{
                  color: colors.text,
                }}
                dropDownContainerStyle={{
                  borderColor: colors.primary,
                  backgroundColor: colors.card,
                  zIndex: 1000,
                }}
                showTickIcon={true}
                zIndex={1000}
                zIndexInverse={3000}
                onChangeValue={(val) => setCategoriaId(val)}
              />
            )}
            <ThemedText style={styles.label}>Imagen del evento</ThemedText>
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              {localImageUri ? (
                <>
                  <Image source={{ uri: localImageUri }} style={styles.imagePreview} />
                  <Button title="Quitar imagen" onPress={quitarImagen} color="red" />
                </>
              ) : (
                <View style={[styles.imagePreview, { backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' }]}>
                  <ThemedText style={{ color: colors.text + '99' }}>Subir imagen</ThemedText>
                </View>
              )}
            </TouchableOpacity>
            <ThemedButton
              title={loading ? 'Enviando...' : 'Crear Evento'}
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
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
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
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  imagePicker: {
    alignSelf: 'center',
    marginBottom: 16,
    width: '100%',
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    marginBottom: 8,
  },
});

export default CreateEventScreen;