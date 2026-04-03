import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  View,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ThemedTitle, ThemedButton, ThemedText } from '../components';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { Button } from 'react-native';
import { Alert } from 'react-native';
import { getAuth, deleteUser } from 'firebase/auth';

type Props = {
  navigation: any;
};

export const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user, setUser, token } = useAuth();
  const [nombre, setNombre] = useState(user?.nombre ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [latitud, setLatitud] = useState<number | null>(user?.ubicacion?.coordinates[1] ?? null);
  const [longitud, setLongitud] = useState<number | null>(user?.ubicacion?.coordinates[0] ?? null);
  const [mapDelta, setMapDelta] = useState({ latitudeDelta: 0.01, longitudeDelta: 0.01 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [intereses, setIntereses] = useState<string[]>(user?.intereses ?? []);
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([]);
  const [fotoPerfil, setFotoPerfil] = useState(user?.fotoPerfil ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esFirebase = !!user?.id;
  const endpointFoto = esFirebase
    ? '/users/upload-profile-image/firebase'
    : '/users/upload-profile-image';
  const endpointPerfil = esFirebase ? '/users/me/firebase' : '/users/me';

  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const res = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/categorias`,
          {
            headers: {
              Authorization: `Bearer ${token || ''}`,
            },
          },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setCategorias(data);
        }
      } catch {
        // Non blocking.
      }
    };

    fetchCategorias();
  }, [token]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const localUri = result.assets[0].uri;
      const formData = new FormData();
      formData.append('file', {
        uri: localUri,
        name: 'profile.jpg',
        type: 'image/jpeg',
      } as any);

      try {
        const res = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}${endpointFoto}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data',
            },
            body: formData,
          }
        );
        const data = await res.json();
        const url = data.url.startsWith('http')
          ? data.url
          : `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}${data.url}`;
        setFotoPerfil(url);
        if (user) setUser({ ...user, fotoPerfil: url });
      } catch (e) {
        setError('No se pudo subir la imagen.');
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const ubicacionData =
        latitud && longitud
          ? { type: 'Point', coordinates: [Number(longitud), Number(latitud)] }
          : null;

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}${endpointPerfil}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token || ''}`,
          },
          body: JSON.stringify({
            nombre,
            email,
            ubicacion: ubicacionData,
            fotoPerfil,
            intereses,
          }),
        }
      );
      if (!res.ok) throw new Error('Error al actualizar');
      const updated = await res.json();
      setUser(updated);
      navigation.goBack();
    } catch (e) {
      setError('No se pudo actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const quitarFotoPerfil = async () => {
    setFotoPerfil('');
    await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}${endpointPerfil}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fotoPerfil: '' }),
    });
    if (user) setUser({ ...user, fotoPerfil: '' });
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Eliminar cuenta',
      '¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const endpoint = '/users/me/firebase';
              const res = await fetch(
                `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}${endpoint}`,
                {
                  method: 'DELETE',
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );
              if (!res.ok) throw new Error('No se pudo eliminar la cuenta en el servidor');

              const auth = getAuth();
              if (auth.currentUser) {
                await deleteUser(auth.currentUser);
              }

              setUser(null);
            } catch (e: any) {
              if (e.code === 'auth/requires-recent-login') {
                Alert.alert(
                  'Reautenticación requerida',
                  'Por seguridad, vuelve a iniciar sesión y vuelve a intentar eliminar la cuenta.'
                );
              } else {
                Alert.alert('Error', e.message || 'No se pudo eliminar la cuenta.');
              }
            }
          },
        },
      ]
    );
  };
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ThemedTitle style={styles.title}>Editar perfil</ThemedTitle>
      <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
        {fotoPerfil ? (
          <>
            <Image source={{ uri: fotoPerfil }} style={styles.profileImage} />
            <Button title="Quitar foto" onPress={quitarFotoPerfil} color="red" />
          </>
        ) : (
          <View
            style={[
              styles.profileImage,
              { backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' },
            ]}
          >
            <ThemedText style={{ color: colors.text + '99' }}>Subir foto</ThemedText>
          </View>
        )}
      </TouchableOpacity>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        placeholder="Nombre"
        placeholderTextColor={colors.text + '99'}
        value={nombre}
        onChangeText={setNombre}
      />
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        placeholder="Correo electrónico"
        placeholderTextColor={colors.text + '99'}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
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
            onSubmitEditing={async () => {
              if (!searchQuery) return;
              setSearchLoading(true);
              try {
                const response = await fetch(
                  `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
                );
                const data = await response.json();
                if (data && data.length > 0) {
                  const lat = parseFloat(data[0].lat);
                  const lon = parseFloat(data[0].lon);
                  setLatitud(lat);
                  setLongitud(lon);
                  setMapDelta({ latitudeDelta: 0.0015, longitudeDelta: 0.0015 });
                } else {
                  setError('No se ha encontrado la dirección o lugar especificado.');
                }
              } catch {
                setError('No se pudo buscar la dirección o lugar.');
              } finally {
                setSearchLoading(false);
              }
            }}
            editable={!searchLoading}
          />
          <TouchableOpacity
            onPress={async () => {
              if (!searchQuery) return;
              setSearchLoading(true);
              try {
                const response = await fetch(
                  `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
                );
                const data = await response.json();
                if (data && data.length > 0) {
                  const lat = parseFloat(data[0].lat);
                  const lon = parseFloat(data[0].lon);
                  setLatitud(lat);
                  setLongitud(lon);
                  setMapDelta({ latitudeDelta: 0.0015, longitudeDelta: 0.0015 });
                } else {
                  setError('No se ha encontrado la dirección o lugar especificado.');
                }
              } catch {
                setError('No se pudo buscar la dirección o lugar.');
              } finally {
                setSearchLoading(false);
              }
            }}
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
          style={{
            height: 180,
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 10,
            borderWidth: 1,
            borderColor: colors.primary,
            position: 'relative',
          }}
        >
          <MapView
            style={StyleSheet.absoluteFillObject}
            region={{
              latitude: latitud ?? 37.3891,
              longitude: longitud ?? -5.9845,
              latitudeDelta: mapDelta.latitudeDelta,
              longitudeDelta: mapDelta.longitudeDelta,
            }}
            onPress={(e) => {
              const lat = e.nativeEvent.coordinate.latitude;
              const lon = e.nativeEvent.coordinate.longitude;
              setLatitud(lat);
              setLongitud(lon);
              setMapDelta({ latitudeDelta: 0.0015, longitudeDelta: 0.0015 });
            }}
          >
            {latitud && longitud && (
              <Marker coordinate={{ latitude: latitud, longitude: longitud }} />
            )}
            <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
          </MapView>
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <ThemedText style={{ color: colors.text + '99' }}>
            {latitud !== null && longitud !== null
              ? `Lat: ${latitud.toFixed(6)}, Lng: ${longitud.toFixed(6)}`
              : 'Toca el mapa para seleccionar la ubicación'}
          </ThemedText>
          {latitud !== null && longitud !== null && (
            <TouchableOpacity
              onPress={() => {
                setLatitud(null);
                setLongitud(null);
                setSearchQuery('');
              }}
              style={{ padding: 4 }}
            >
              <Icon name="close-circle" size={20} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={styles.interestsContainer}>
        <ThemedText style={{ marginBottom: 8, fontWeight: '700' }}>Intereses</ThemedText>
        {categorias.length === 0 ? (
          <ThemedText style={{ color: colors.text + '99', marginBottom: 12 }}>
            No se pudieron cargar categorías.
          </ThemedText>
        ) : (
          <View style={styles.interestsChipsWrap}>
            {categorias.map((categoria) => {
              const selected = intereses.includes(categoria.nombre);
              return (
                <TouchableOpacity
                  key={categoria.id}
                  style={[
                    styles.interestChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.card,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => {
                    setIntereses((prev) =>
                      selected
                        ? prev.filter((item) => item !== categoria.nombre)
                        : [...prev, categoria.nombre],
                    );
                  }}
                >
                  <ThemedText style={{ color: selected ? '#fff' : colors.primary, fontSize: 13 }}>
                    {categoria.nombre}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
      {error && <ThemedText style={{ color: colors.error, marginBottom: 8 }}>{error}</ThemedText>}
      <ThemedButton
        title={saving ? 'Guardando...' : 'Guardar'}
        onPress={handleSave}
        disabled={saving}
        style={styles.saveButton}
      />
      <ThemedButton
        title="Cambiar contraseña"
        variant="secondary"
        onPress={() => navigation.navigate('EditPassword')}
        style={[styles.cancelButton, { backgroundColor: colors.primary }]}
        textStyle={{ color: '#fff' }}
      />
      <ThemedButton
        title="Cancelar"
        variant="secondary"
        onPress={() => navigation.goBack()}
        style={styles.cancelButton}
      />
      <ThemedButton
        title="Eliminar cuenta"
        variant="secondary"
        onPress={handleDeleteAccount}
        style={[styles.cancelButton, { backgroundColor: colors.error }]}
        textStyle={{ color: '#fff' }}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 24, alignSelf: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  imagePicker: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 8,
  },
  mapSearchInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  mapSearchButton: {
    padding: 8,
    marginLeft: 8,
  },
  saveButton: { marginTop: 8 },
  cancelButton: { marginTop: 8 },
  interestsContainer: {
    marginBottom: 12,
  },
  interestsChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
});
