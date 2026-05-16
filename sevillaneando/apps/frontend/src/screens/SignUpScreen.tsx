import React, { useState } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  Keyboard,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createUserWithEmailAndPassword, updateProfile, getIdToken } from 'firebase/auth';
import { getFirebaseErrorMessage } from '../utils/firebaseErrors';
import { auth } from '../firebase/config';
import { api, setAuthToken } from '../services';
import { useTheme } from '../hooks/useTheme';
import { useAuthContext } from '../context/AuthContext';
import {
  ThemedButton,
  ThemedText,
  ThemedTextSecondary,
  ThemedTitle,
  ThemedView,
} from '../components';
import type { AuthStackParamList } from '../navigation/types';
import type { User as AppUser } from '../types/user';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { setUser } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      if (!nombre.trim()) {
        setError('Por favor ingresa tu nombre.');
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        setLoading(false);
        return;
      }
      if (!privacyAccepted) {
        setError('Debes aceptar la política de privacidad para continuar.');
        setLoading(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(userCredential.user, { displayName: nombre.trim() });
      const freshToken = await getIdToken(userCredential.user, true);
      setAuthToken(freshToken);
      await api.patch('/users/me/firebase', { nombre: nombre.trim() });
      const refreshed = await api.get<AppUser>('/users/me');
      setUser(refreshed.data);
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ImageBackground
        source={require('../../assets/icon.png')}
        style={[styles.background, { backgroundColor: colors.background }]}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.container}>
          <ThemedTitle style={styles.title}>Crear cuenta</ThemedTitle>
          <ThemedTextSecondary style={styles.subtitle}>Únete a Sevillaneando</ThemedTextSecondary>

          <ThemedView style={styles.form}>
            <TextInput
              value={nombre}
              onChangeText={setNombre}
              placeholder="Nombre completo"
              autoCapitalize="words"
              style={[
                styles.input,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
              ]}
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              style={[
                styles.input,
                { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
              ]}
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.passwordContainer}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Contraseña"
                secureTextEntry={!showPassword}
                style={[
                  styles.inputPassword,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                placeholderTextColor={colors.textSecondary}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="white" />
              </TouchableOpacity>
            </View>
            <View style={styles.passwordContainer}>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirmar contraseña"
                secureTextEntry={!showConfirmPassword}
                style={[
                  styles.inputPassword,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                placeholderTextColor={colors.textSecondary}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={22} color="white" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.privacyRow}
              onPress={() => setPrivacyAccepted(!privacyAccepted)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: colors.primary,
                    backgroundColor: privacyAccepted ? colors.primary : 'transparent',
                  },
                ]}
              >
                {privacyAccepted && <Ionicons name="checkmark" size={14} color="white" />}
              </View>
              <ThemedTextSecondary style={styles.privacyText}>
                He leído y acepto la{' '}
                <ThemedText
                  style={[styles.privacyLink, { color: colors.primary }]}
                  onPress={() => navigation.navigate('PrivacyPolicy')}
                >
                  política de privacidad
                </ThemedText>
              </ThemedTextSecondary>
            </TouchableOpacity>

            {error && (
              <ThemedText style={[styles.error, { color: colors.error }]}>{error}</ThemedText>
            )}
            <ThemedButton
              title={loading ? 'Creando cuenta...' : 'Registrarse'}
              onPress={onSubmit}
              disabled={loading}
            />
          </ThemedView>

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              ¿Ya tienes cuenta? Inicia sesión
            </ThemedText>
          </TouchableOpacity>
        </SafeAreaView>
      </ImageBackground>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  backgroundImage: { opacity: 0.2, transform: [{ scale: 1.5 }, { translateY: 40 }] },
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { marginBottom: 6, textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: 20 },
  form: { gap: 12, marginBottom: 20 },
  input: { borderRadius: 50, padding: 14, borderWidth: 1 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center' },
  inputPassword: { flex: 1, borderRadius: 50, padding: 14, borderWidth: 1, paddingRight: 50 },
  eyeButton: { position: 'absolute', right: 16 },
  eyeIcon: { fontSize: 18 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyText: { flex: 1, fontSize: 13, lineHeight: 18 },
  privacyLink: { fontWeight: '700' },
  error: { textAlign: 'center' },
  link: { textAlign: 'center', fontWeight: '600' },
});
