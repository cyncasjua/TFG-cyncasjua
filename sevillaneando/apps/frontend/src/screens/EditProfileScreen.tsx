import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, SupportedLanguage } from '../i18n/i18n';
import {
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  View,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ThemedTitle, ThemedButton, ThemedText, OsmAttribution } from '../components';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { reportWarning } from '../utils/telemetry';
import { getFullImageUrl } from '../utils/imageUrl';
import { OSM_TILE_URL_TEMPLATE, SEVILLE_COORDINATES } from '../utils/map';
import { API_BASE_URL } from '../services';
import { Button } from 'react-native';
import { Alert } from 'react-native';
import { getAuth, deleteUser } from 'firebase/auth';
import { useFocusEffect } from '@react-navigation/native';

type Props = {
  navigation: any;
};

export const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user, setUser, token } = useAuth();
  const { t, i18n } = useTranslation();
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
  const resolvedFotoPerfil = getFullImageUrl(fotoPerfil);

  const fetchCategorias = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/categorias`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        setCategorias(data);
      }
    } catch (err) {
      reportWarning('edit-profile.fetch-categories', 'No se pudieron cargar categorías', err);
    }
  }, [token]);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  useFocusEffect(
    useCallback(() => {
      fetchCategorias();
    }, [fetchCategorias])
  );

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
        const res = await fetch(`${API_BASE_URL}${endpointFoto}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          body: formData,
        });
        const data = await res.json();
        const url = data.url.startsWith('http') ? data.url : `${API_BASE_URL}${data.url}`;
        setFotoPerfil(url);
        if (user) setUser({ ...user, fotoPerfil: url });
      } catch (e) {
        setError(t('editProfile.imageUploadError'));
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

      const res = await fetch(`${API_BASE_URL}${endpointPerfil}`, {
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
      });
      if (!res.ok) throw new Error('Error al actualizar');
      const updated = await res.json();
      setUser(updated);
      navigation.goBack();
    } catch (e) {
      setError(t('editProfile.profileUpdateError'));
    } finally {
      setSaving(false);
    }
  };

  const quitarFotoPerfil = async () => {
    setFotoPerfil('');
    await fetch(`${API_BASE_URL}${endpointPerfil}`, {
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
    Alert.alert(t('editProfile.deleteAccountTitle'), t('editProfile.deleteAccountMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            const endpoint = '/users/me/firebase';
            const res = await fetch(`${API_BASE_URL}${endpoint}`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            if (!res.ok) throw new Error(t('editProfile.deleteAccountError'));

            const auth = getAuth();
            if (auth.currentUser) {
              await deleteUser(auth.currentUser);
            }

            setUser(null);
          } catch (e: any) {
            if (e.code === 'auth/requires-recent-login') {
              Alert.alert(t('editProfile.reauthRequired'), t('editProfile.reauthMsg'));
            } else {
              Alert.alert(t('common.error'), e.message || t('editProfile.deleteAccountError'));
            }
          }
        },
      },
    ]);
  };
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ThemedTitle style={styles.title}>{t('editProfile.title')}</ThemedTitle>
        <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
          {resolvedFotoPerfil ? (
            <>
              <Image source={{ uri: resolvedFotoPerfil }} style={styles.profileImage} />
              <Button title={t('editProfile.removePhoto')} onPress={quitarFotoPerfil} color="red" />
            </>
          ) : (
            <View
              style={[
                styles.profileImage,
                { backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' },
              ]}
            >
              <ThemedText style={{ color: colors.text + '99' }}>
                {t('editProfile.uploadPhoto')}
              </ThemedText>
            </View>
          )}
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder={t('common.name')}
          placeholderTextColor={colors.text + '99'}
          value={nombre}
          onChangeText={setNombre}
        />
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          placeholder={t('editProfile.email')}
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
              placeholder={t('editProfile.searchAddress')}
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
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                      searchQuery
                    )}`
                  );
                  const data = await response.json();
                  if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    setLatitud(lat);
                    setLongitud(lon);
                    setMapDelta({ latitudeDelta: 0.0015, longitudeDelta: 0.0015 });
                  } else {
                    setError(t('editProfile.addressNotFound'));
                  }
                } catch (err) {
                  reportWarning(
                    'edit-profile.search-submit',
                    'Error buscando dirección por submit',
                    err
                  );
                  setError(t('editProfile.addressError'));
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
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                      searchQuery
                    )}`
                  );
                  const data = await response.json();
                  if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    setLatitud(lat);
                    setLongitud(lon);
                    setMapDelta({ latitudeDelta: 0.0015, longitudeDelta: 0.0015 });
                  } else {
                    setError(t('editProfile.addressNotFound'));
                  }
                } catch (err) {
                  reportWarning(
                    'edit-profile.search-button',
                    'Error buscando dirección por botón',
                    err
                  );
                  setError(t('editProfile.addressError'));
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
              borderRadius: 30,
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
                latitude: latitud ?? SEVILLE_COORDINATES.latitude,
                longitude: longitud ?? SEVILLE_COORDINATES.longitude,
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
              <UrlTile urlTemplate={OSM_TILE_URL_TEMPLATE} maximumZ={19} />
            </MapView>
          </View>
          <View style={{ marginBottom: 8 }}>
            <OsmAttribution compact />
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
                : t('editProfile.tapMapLocation')}
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
          <ThemedText style={{ marginBottom: 8, fontWeight: '700' }}>
            {t('editProfile.interests')}
          </ThemedText>
          {categorias.length === 0 ? (
            <ThemedText style={{ color: colors.text + '99', marginBottom: 12 }}>
              {t('editProfile.noCategoriesLoaded')}
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
                          : [...prev, categoria.nombre]
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
        <View style={styles.actionsGroup}>
          <ThemedButton
            title={saving ? t('common.saving') : t('common.save')}
            onPress={handleSave}
            disabled={saving}
            style={styles.primaryAction}
          />
          <ThemedButton
            title={t('editProfile.changePassword')}
            variant="secondary"
            onPress={() => navigation.navigate('EditPassword')}
            style={[
              styles.secondaryAction,
              styles.outlinePrimaryAction,
              { borderColor: colors.primary },
            ]}
            textStyle={{ color: colors.primary }}
          />

          {/* Language selector */}
          <ThemedText style={{ fontWeight: '700', marginTop: 8 }}>
            {t('editProfile.language')}
          </ThemedText>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {(['es', 'en'] as SupportedLanguage[]).map((lang) => (
              <TouchableOpacity
                key={lang}
                onPress={() => changeLanguage(lang)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 30,
                  borderWidth: 2,
                  borderColor: i18n.language === lang ? colors.primary : colors.border,
                  backgroundColor: i18n.language === lang ? colors.primary : 'transparent',
                  alignItems: 'center',
                }}
              >
                <ThemedText
                  style={{
                    color: i18n.language === lang ? '#fff' : colors.primary,
                    fontWeight: '600',
                  }}
                >
                  {lang === 'es' ? t('editProfile.languageEs') : t('editProfile.languageEn')}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <ThemedButton
            title={t('editProfile.deleteAccount')}
            variant="secondary"
            onPress={handleDeleteAccount}
            style={[styles.secondaryAction, { backgroundColor: colors.error }]}
            textStyle={{ color: '#fff' }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  scrollContent: { paddingTop: 24, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 24, alignSelf: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: 30,
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
    borderRadius: 30,
    padding: 12,
    fontSize: 16,
  },
  mapSearchButton: {
    padding: 8,
    marginLeft: 8,
  },
  actionsGroup: {
    marginTop: 12,
    gap: 12,
  },
  primaryAction: {
    minHeight: 48,
  },
  secondaryAction: {
    minHeight: 48,
  },
  outlinePrimaryAction: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
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
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
});
