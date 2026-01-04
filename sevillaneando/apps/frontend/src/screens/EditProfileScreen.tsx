import React, { useState } from 'react';
import { StyleSheet, TextInput, KeyboardAvoidingView, Platform, TouchableOpacity, Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
  const [ubicacion, setUbicacion] = useState(user?.ubicacion ?? '');
  const [intereses, setIntereses] = useState(user?.intereses?.join(', ') ?? '');
  const [fotoPerfil, setFotoPerfil] = useState(user?.fotoPerfil ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esFirebase = !!user?.id;
  const endpointFoto = esFirebase
    ? '/users/upload-profile-image/firebase'
    : '/users/upload-profile-image';
  const endpointPerfil = esFirebase
    ? '/users/me/firebase'
    : '/users/me';

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
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
              'Authorization': `Bearer ${token}`,
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
            ubicacion,
            fotoPerfil,
            intereses: intereses.split(',').map(i => i.trim()).filter(Boolean),
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
          <View style={[styles.profileImage, { backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' }]}>
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
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        placeholder="Ubicación"
        placeholderTextColor={colors.text + '99'}
        value={ubicacion}
        onChangeText={setUbicacion}
      />
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        placeholder="Intereses (separados por coma)"
        placeholderTextColor={colors.text + '99'}
        value={intereses}
        onChangeText={setIntereses}
      />
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
  saveButton: { marginTop: 8 },
  cancelButton: { marginTop: 8 },
});