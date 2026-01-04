import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, LogBox, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeScreen } from './screens/HomeScreen';
import { EventDetailScreen } from './screens/EventDetailScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SignUpScreen } from './screens/SignUpScreen';
import { AdminScreen } from './screens/AdminScreen';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { useAuth } from './hooks/useAuth';
import type { Event } from './types/event';

// Suprimir warnings específicos
LogBox.ignoreLogs([
  'You are initializing Firebase Auth',
  'SafeAreaView has been deprecated',
  'Non-serializable values were found in the navigation state'
]);

export type RootStackParamList = {
  Home: undefined;
  EventDetail: { event: Event };
  Admin: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

const AppStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

const Navigator = () => {
  const { user, loading, role } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Comprobando sesión...</Text>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <AppStack.Navigator>
          <AppStack.Screen name="Home" component={HomeScreen} options={{ title: 'Sevillaneando' }} />
          <AppStack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Detalle del evento' }} />
          {role === 'admin' && (
            <AppStack.Screen name="Admin" component={AdminScreen} options={{ title: 'Panel de Admin' }} />
          )}
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="SignUp" component={SignUpScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
};

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <Navigator />
    </AuthProvider>
  </ThemeProvider>
);

export default App;
