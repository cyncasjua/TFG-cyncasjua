import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  TextInput,
  StyleSheet,
  View,
  TouchableOpacity,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { ThemedTitle, ThemedButton, ThemedText } from '../components';

type Props = {
  navigation: any;
};

export const EditPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);

  const esFirebase = !!user?.firebaseUid;

  const handleChangePasswordFirebase = async () => {
    setError(null);

    if (!currentPassword || !newPassword || !repeatPassword) {
      setError('Por favor, rellena todos los campos.');
      return;
    }
    if (newPassword !== repeatPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        setError('No hay usuario autenticado.');
        setLoading(false);
        return;
      }
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      alert('Contraseña cambiada correctamente');
      navigation.goBack();
    } catch (e: any) {
      if (e.code === 'auth/wrong-password') {
        setError('La contraseña actual es incorrecta.');
      } else {
        setError(e.message || 'No se pudo cambiar la contraseña');
      }
    }
    setLoading(false);
  };

  const handleChangePasswordBackend = async () => {
    setError(null);

    if (!currentPassword || !newPassword || !repeatPassword) {
      setError('Por favor, rellena todos los campos.');
      return;
    }
    if (newPassword !== repeatPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = '/users/change-password';
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}${endpoint}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        navigation.goBack();
      } else {
        setError(data.message || 'No se pudo cambiar la contraseña');
      }
    } catch (e) {
      setError('No se pudo conectar con el servidor');
    }
    setLoading(false);
  };

  const handleChangePassword = esFirebase
    ? handleChangePasswordFirebase
    : handleChangePasswordBackend;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ThemedTitle style={styles.title}>Cambiar contraseña</ThemedTitle>
      <View style={styles.inputWrapper}>
        <TextInput
          placeholder="Contraseña actual"
          placeholderTextColor={colors.text + '99'}
          secureTextEntry={!showCurrent}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.eyeButton} onPress={() => setShowCurrent(!showCurrent)}>
          <Ionicons name={showCurrent ? 'eye-off' : 'eye'} size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.inputWrapper}>
        <TextInput
          placeholder="Nueva contraseña"
          placeholderTextColor={colors.text + '99'}
          secureTextEntry={!showNew}
          value={newPassword}
          onChangeText={setNewPassword}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.eyeButton} onPress={() => setShowNew(!showNew)}>
          <Ionicons name={showNew ? 'eye-off' : 'eye'} size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.inputWrapper}>
        <TextInput
          placeholder="Repite la nueva contraseña"
          placeholderTextColor={colors.text + '99'}
          secureTextEntry={!showRepeat}
          value={repeatPassword}
          onChangeText={setRepeatPassword}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.eyeButton} onPress={() => setShowRepeat(!showRepeat)}>
          <Ionicons name={showRepeat ? 'eye-off' : 'eye'} size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
      {error && <ThemedText style={{ color: '#d32f2f', marginBottom: 8 }}>{error}</ThemedText>}
      <ThemedButton
        title={loading ? 'Cambiando...' : 'Cambiar contraseña'}
        onPress={loading ? undefined : handleChangePassword}
        disabled={loading}
        style={styles.saveButton}
      />
      <ThemedButton
        title="Cancelar"
        variant="secondary"
        onPress={() => navigation.goBack()}
        style={styles.cancelButton}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 24, alignSelf: 'center' },
  inputWrapper: { position: 'relative', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    paddingRight: 48,
    fontSize: 16,
  },
  eyeButton: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
  saveButton: { marginTop: 8 },
  cancelButton: { marginTop: 8 },
});
