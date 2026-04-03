import React from 'react';
import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, LogBox, Text, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ExpoLinking from 'expo-linking';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeScreen } from './screens/HomeScreen';
import { EventDetailScreen } from './screens/EventDetailScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SignUpScreen } from './screens/SignUpScreen';
import { AdminScreen } from './screens/AdminScreen';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';
import { NotificacionesProvider } from './context/NotificacionesContext';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import type { Event } from './types/event';
import { EditProfileScreen } from './screens/EditProfileScreen';
import { EditPasswordScreen } from './screens/EditPasswordScreen';
import CreateEventScreen from './screens/CreateEventScreen';
import { ModeratorEventsScreen } from './screens/ModeratorEventsScreen';
import { ModeratorEditEventScreen } from './screens/ModeratorEditEventScreen';
import { NotificacionesScreen } from './screens/NotificacionesScreen';
import CategoriesScreen from './screens/CategoriesScreen';
import { EventsMapScreen } from './screens/EventsMapScreen';
import { UserProfileScreen } from './screens/UserProfileScreen';
import { DirectMessageScreen } from './screens/DirectMessageScreen';
import { MessagesScreen } from './screens/MessagesScreen';
import { AccessPrivateEventScreen } from './screens/AccessPrivateEventScreen';
import UserEventsScreen from './screens/UserEventsScreen';
import CalendarEventsScreen from './screens/CalendarEventsScreen';
import UserEditEventScreen from './screens/UserEditEventScreen';
import { RoutePreviewScreen } from './screens/RoutePreviewScreen';
import { SavedAndPrivateEventsScreen } from './screens/SavedAndPrivateEventsScreen';
import { getEventById } from './services/api';
import type { RecommendedRoute } from './services/api';

LogBox.ignoreLogs([
  'You are initializing Firebase Auth',
  'SafeAreaView has been deprecated',
  'Non-serializable values were found in the navigation state',
]);

export type RootStackParamList = {
  Home: undefined;
  EventDetail: { event: Event };
  EventDetailLink: { eventId: string };
  Admin: undefined;
  EditProfile: undefined;
  EditPassword: undefined;
  CreateEvent: undefined;
  EditEvent: { event: Event };
  ModeratorEvents: undefined;
  ModeratorEditEvent: { event: Event };
  Notifications: undefined;
  Categories: undefined;
  EventsMap: undefined;
  UserProfile: { userId: string };
  DirectMessage: { userId: string; userName: string };
  Messages: undefined;
  AccessPrivateEvent: { linkAcceso: string };
  UserEvents: undefined;
  CalendarEvents: undefined;
  RoutePreview: { routePlan: RecommendedRoute };
  SavedAndPrivateEvents: { mode?: 'saved' | 'private' | 'both' };
};

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

const AppStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

const EventDetailLinkScreen = ({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'EventDetailLink'>) => {
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    getEventById(route.params.eventId)
      .then((event) => {
        if (!isMounted) return;
        navigation.replace('EventDetail', { event });
      })
      .catch(() => {
        if (!isMounted) return;
        setError('No se pudo abrir el evento.');
      });

    return () => {
      isMounted = false;
    };
  }, [navigation, route.params.eventId]);

  return (
    <SafeAreaView
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {!error ? (
        <>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8 }}>Abriendo evento...</Text>
        </>
      ) : (
        <Text>{error}</Text>
      )}
    </SafeAreaView>
  );
};

const Navigator = () => {
  const { user, loading, role } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 8, color: colors.text }}>Comprobando sesión...</Text>
      </SafeAreaView>
    );
  }

  const shareBaseUrl = process.env.EXPO_PUBLIC_SHARE_BASE_URL?.replace(/\/$/, '');
  const linking: LinkingOptions<RootStackParamList> = {
    prefixes: [
      ExpoLinking.createURL('/'),
      'sevillaneando://',
      ...(shareBaseUrl ? [shareBaseUrl] : []),
    ],
    config: {
      screens: {
        Home: '',
        EventDetailLink: 'evento/:eventId',
        AccessPrivateEvent: 'acceso/:linkAcceso',
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
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
                  <Image
                    source={require('../assets/icon.png')}
                    style={{ width: 28, height: 28, marginRight: 8 }}
                  />
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text }}>
                    Sevillaneando
                  </Text>
                </View>
              ),
            }}
          />
          <AppStack.Screen
            name="EventDetail"
            component={EventDetailScreen}
            options={{ title: 'Detalle del evento' }}
          />
          <AppStack.Screen
            name="EventDetailLink"
            component={EventDetailLinkScreen}
            options={{ title: 'Abriendo evento...' }}
          />
          <AppStack.Screen
            name="EventsMap"
            component={EventsMapScreen}
            options={{ title: 'Mapa de eventos', headerShown: false }}
          />
          {role === 'admin' && (
            <>
              <AppStack.Screen
                name="Admin"
                component={AdminScreen}
                options={{ title: 'Panel de Admin' }}
              />
              <AppStack.Screen
                name="Categories"
                component={CategoriesScreen}
                options={{ title: 'Gestión de categorías' }}
              />
            </>
          )}
          <AppStack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ title: 'Editar perfil' }}
          />
          <AppStack.Screen
            name="EditPassword"
            component={EditPasswordScreen}
            options={{ title: 'Cambiar contraseña' }}
          />
          <AppStack.Screen
            name="CreateEvent"
            component={CreateEventScreen}
            options={{ title: 'Crear evento' }}
          />
          {role === 'moderator' && (
            <>
              <AppStack.Screen
                name="ModeratorEvents"
                component={ModeratorEventsScreen}
                options={{ title: 'Moderación' }}
              />
              <AppStack.Screen
                name="ModeratorEditEvent"
                component={ModeratorEditEventScreen}
                options={{ title: 'Editar evento' }}
              />
            </>
          )}
          <AppStack.Screen
            name="Notifications"
            component={NotificacionesScreen}
            options={{ title: 'Notificaciones' }}
          />
          <AppStack.Screen
            name="Messages"
            component={MessagesScreen}
            options={{ title: 'Mensajes' }}
          />
          <AppStack.Screen
            name="UserProfile"
            component={UserProfileScreen}
            options={{ title: 'Perfil' }}
          />
          <AppStack.Screen
            name="DirectMessage"
            component={DirectMessageScreen}
            options={{ title: 'Mensaje privado' }}
          />
          <AppStack.Screen
            name="AccessPrivateEvent"
            component={AccessPrivateEventScreen}
            options={{ title: 'Acceso privado' }}
          />
          <AppStack.Screen
            name="EditEvent"
            component={UserEditEventScreen}
            options={{ title: 'Editar evento' }}
          />
          <AppStack.Screen
            name="UserEvents"
            component={UserEventsScreen}
            options={{ title: 'Mis eventos' }}
          />
          <AppStack.Screen
            name="CalendarEvents"
            component={CalendarEventsScreen}
            options={{ title: 'Calendario' }}
          />
          <AppStack.Screen
            name="RoutePreview"
            component={RoutePreviewScreen}
            options={{ title: 'Ruta recomendada' }}
          />
          <AppStack.Screen
            name="SavedAndPrivateEvents"
            component={SavedAndPrivateEventsScreen}
            options={{ title: 'Guardados y privados' }}
          />
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
  <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <NotificacionesProvider>
            <Navigator />
          </NotificacionesProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  </GestureHandlerRootView>
);

export default App;
