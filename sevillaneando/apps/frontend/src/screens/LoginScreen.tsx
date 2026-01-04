import React, { useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';
import type { AuthStackParamList } from '../App';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      
      // Guardar preferencia de mantener sesión
      await AsyncStorage.setItem('rememberMe', rememberMe ? 'true' : 'false');
      if (rememberMe) {
        await AsyncStorage.setItem('savedEmail', email.trim());
      } else {
        await AsyncStorage.removeItem('savedEmail');
      }
    } catch (err: any) {
      const message = err?.message ?? 'No se pudo iniciar sesión.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Inicia sesión</Text>
      <Text style={styles.subtitle}>Accede con tu cuenta para continuar.</Text>

      <View style={styles.form}>
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
        
        <View style={styles.checkboxContainer}>
          <TouchableOpacity
            style={[styles.checkbox, rememberMe && styles.checkboxChecked]}
            onPress={() => setRememberMe(!rememberMe)}
          >
            {rememberMe && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <Text style={styles.checkboxLabel}>Mantener sesión iniciada</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
        <Text style={styles.link}>¿No tienes cuenta? Regístrate aquí</Text>
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
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderColor: '#1d4ed8', borderRadius: 4, marginRight: 8, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#1d4ed8' },
  checkmark: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  checkboxLabel: { fontSize: 14, color: '#111' },
  button: { backgroundColor: '#1d4ed8', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b91c1c', textAlign: 'center' },
  link: { color: '#1d4ed8', textAlign: 'center', fontWeight: '600' }
});