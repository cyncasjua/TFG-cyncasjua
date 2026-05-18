import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, ImageBackground, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  ThemedButton,
  ThemedText,
  ThemedTextSecondary,
  ThemedTitle,
  ThemedView,
} from '../components';
import type { AuthStackParamList } from '../navigation/types';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { getFirebaseErrorMessage } from '../utils/firebaseErrors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);

      await AsyncStorage.setItem('rememberMe', rememberMe ? 'true' : 'false');
      if (rememberMe) {
        await AsyncStorage.setItem('savedEmail', email.trim());
      } else {
        await AsyncStorage.removeItem('savedEmail');
      }
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError(t('login.emailRequired'));
      return;
    }
    try {
      await sendPasswordResetEmail(getAuth(), email.trim());
      setError(null);
      alert(t('login.resetEmailSent'));
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
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
        <ThemedTitle style={styles.title}>{t('login.title')}</ThemedTitle>
        <ThemedTextSecondary style={styles.subtitle}>
          {t('login.subtitle')}
        </ThemedTextSecondary>

        <ThemedView style={styles.form}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('login.email')}
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
              placeholder={t('login.password')}
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

          <ThemedView style={styles.checkboxContainer}>
            <TouchableOpacity
              style={[
                styles.checkbox,
                {
                  borderColor: colors.primary,
                  backgroundColor: rememberMe ? colors.primary : 'transparent',
                },
              ]}
              onPress={() => setRememberMe(!rememberMe)}
            >
              {rememberMe && (
                <ThemedText style={[styles.checkmark, { color: colors.background }]}>✓</ThemedText>
              )}
            </TouchableOpacity>
            <ThemedText style={styles.checkboxLabel}>{t('login.keepSession')}</ThemedText>
          </ThemedView>

          {error && (
            <ThemedText style={[styles.error, { color: colors.error }]}>{error}</ThemedText>
          )}
          <ThemedButton
            title={loading ? t('login.signingIn') : t('login.signIn')}
            onPress={onSubmit}
            disabled={loading}
          />
        </ThemedView>

        <TouchableOpacity onPress={handleForgotPassword} style={{ marginTop: 16 }}>
          <ThemedText style={[styles.link, { color: colors.primary }]}>
            {t('login.forgotPassword')}
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={{ marginTop: 32 }}>
          <ThemedText style={[styles.link, { color: colors.primary }]}>
            {t('login.noAccount')}
          </ThemedText>
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
  form: { gap: 12, marginBottom: 20, borderRadius: 30, padding: 16 },
  input: { borderRadius: 50, padding: 14, borderWidth: 1 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center' },
  inputPassword: { flex: 1, borderRadius: 50, padding: 14, borderWidth: 1, paddingRight: 50 },
  eyeButton: { position: 'absolute', right: 16 },
  eyeIcon: { fontSize: 18 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 50,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: { fontWeight: 'bold', fontSize: 16 },
  checkboxLabel: { fontSize: 14 },
  error: { textAlign: 'center' },
  link: { textAlign: 'center', fontWeight: '600' },
});
