import React, { useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createUserWithEmailAndPassword , updateProfile} from 'firebase/auth';
import { auth } from '../firebase/config';
import type { AuthStackParamList } from '../App';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export const SignUpScreen: React.FC<Props> = ({ navigation }) => {
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
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>
      <Text style={styles.subtitle}>Únete a Sevillaneando</Text>

      <View style={styles.form}>
        <TextInput
          value={nombre}
          onChangeText={setNombre}
          placeholder="Nombre completo"
          autoCapitalize="words"
          style={styles.input}
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Contraseña"
          secureTextEntry
          style={styles.input}
        />
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirmar contraseña"
          secureTextEntry
          style={styles.input}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Registrarse</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>¿Ya tienes cuenta? Inicia sesión</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#f7f7f7' },
  title: { fontSize: 24, fontWeight: '800', color: '#111', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#444', textAlign: 'center', marginBottom: 20 },
  form: { gap: 12, marginBottom: 20 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  button: { backgroundColor: '#1d4ed8', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b91c1c', textAlign: 'center' },
  link: { color: '#1d4ed8', textAlign: 'center', fontWeight: '600' }
});
