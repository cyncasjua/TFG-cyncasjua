import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createUserWithEmailAndPassword , updateProfile} from 'firebase/auth';
import { auth } from '../firebase/config';
import { useTheme } from '../hooks/useTheme';
import { ThemedButton, ThemedText, ThemedTextSecondary, ThemedTitle, ThemedView } from '../components';
import type { AuthStackParamList } from '../App';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nombre, setNombre] = useState('');
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

      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      // Actualiza el nombre de usuario en Firebase
      await updateProfile(userCredential.user, { displayName: nombre });
    } catch (err: any) {
      const message = err?.message ?? 'Error al crear la cuenta.';
      setError(message);
      setLoading(false);
    }
  };

  return (
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
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Contraseña"
            secureTextEntry
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirmar contraseña"
            secureTextEntry
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholderTextColor={colors.textSecondary}
          />
          {error && <ThemedText style={[styles.error, { color: colors.error }]}>{error}</ThemedText>}
          <ThemedButton title={loading ? 'Creando cuenta...' : 'Registrarse'} onPress={onSubmit} disabled={loading} />
        </ThemedView>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <ThemedText style={[styles.link, { color: colors.primary }]}>¿Ya tienes cuenta? Inicia sesión</ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    </ImageBackground>
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
  error: { textAlign: 'center' },
  link: { textAlign: 'center', fontWeight: '600' }
});
