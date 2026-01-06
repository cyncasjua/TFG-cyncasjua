import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, LogBox, Text, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeScreen } from './screens/HomeScreen';
import { EventDetailScreen } from './screens/EventDetailScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SignUpScreen } from './screens/SignUpScreen';
import { AdminScreen } from './screens/AdminScreen';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import type { Event } from './types/event';
import { EditProfileScreen } from './screens/EditProfileScreen';
import { EditPasswordScreen } from './screens/EditPasswordScreen';
import CreateEventScreen from './screens/CreateEventScreen';
import { ModeratorEventsScreen } from './screens/ModeratorEventsScreen';
import { NotificacionesScreen } from './screens/NotificacionesScreen'; 
import { MaterialIcons } from '@expo/vector-icons';

LogBox.ignoreLogs([
  'You are initializing Firebase Auth',
  'SafeAreaView has been deprecated',
  'Non-serializable values were found in the navigation state'
]);

export type RootStackParamList = {
  Home: undefined;
  EventDetail: { event: Event };
  Admin: undefined;
  EditProfile: undefined;
  EditPassword: undefined;
  CreateEvent: undefined;
  ModeratorEvents: undefined;
  Notifications: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

const AppStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

const Navigator = () => {
  const { user, loading, role } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 8, color: colors.text }}>Comprobando sesión...</Text>
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <AppStack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
            headerTitleStyle: {
              color: colors.text,
            },
            animation: 'fade',
            animationTypeForReplace: 'pop',
          }}
        >
          <AppStack.Screen
            name="Home"
            component={HomeScreen}
            options={{
              headerTitle: () => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image source={require('../assets/icon.png')} style={{ width: 28, height: 28, marginRight: 8 }} />
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>Sevillaneando</Text>
                </View>
              )
            }}
          />
          <AppStack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Detalle del evento' }} />
          {role === 'admin' && (
            <AppStack.Screen name="Admin" component={AdminScreen} options={{ title: 'Panel de Admin' }} />
          )}
          <AppStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Editar perfil' }} />
          <AppStack.Screen name="EditPassword" component={EditPasswordScreen} options={{ title: 'Cambiar contraseña' }} />
          <AppStack.Screen name="CreateEvent" component={CreateEventScreen} options={{ title: 'Crear evento' }} />
          {role === 'moderator' && (
            <AppStack.Screen name="ModeratorEvents" component={ModeratorEventsScreen} options={{ title: 'Moderación' }} />
          )}
          <AppStack.Screen name="Notifications" component={NotificacionesScreen} options={{ title: 'Notificaciones' }} />
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
