import React from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

import { linking } from './linking';
import type { AuthStackParamList, RootStackParamList } from './types';
import { EventDetailLinkScreen } from '../screens/EventDetailLinkScreen';

import { HomeScreen } from '../screens/HomeScreen';
import { EventDetailScreen } from '../screens/EventDetailScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
import { AdminScreen } from '../screens/AdminScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { EditPasswordScreen } from '../screens/EditPasswordScreen';
import CreateEventScreen from '../screens/CreateEventScreen';
import { ModeratorEventsScreen } from '../screens/ModeratorEventsScreen';
import { ModeratorEditEventScreen } from '../screens/ModeratorEditEventScreen';
import { NotificacionesScreen } from '../screens/NotificacionesScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import { EventsMapScreen } from '../screens/EventsMapScreen';
import { UserProfileScreen } from '../screens/UserProfileScreen';
import { DirectMessageScreen } from '../screens/DirectMessageScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { AccessPrivateEventScreen } from '../screens/AccessPrivateEventScreen';
import UserEventsScreen from '../screens/UserEventsScreen';
import CalendarEventsScreen from '../screens/CalendarEventsScreen';
import UserEditEventScreen from '../screens/UserEditEventScreen';
import { RoutePreviewScreen } from '../screens/RoutePreviewScreen';
import { CreateRouteScreen } from '../screens/CreateRouteScreen';
import { RoutesListScreen } from '../screens/RoutesListScreen';
import { RouteDetailScreen } from '../screens/RouteDetailScreen';
import { SavedAndPrivateEventsScreen } from '../screens/SavedAndPrivateEventsScreen';
import { LegalAttributionsScreen } from '../screens/LegalAttributionsScreen';
import { FriendsScreen } from '../screens/FriendsScreen';

const AppStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

export function AppNavigator() {
  const { user, loading, role } = useAuth();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 8, color: colors.text }}>
          Comprobando sesión...
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      {user ? (
        <AppStack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { color: colors.text },
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
                    source={
                      theme === 'dark'
                        ? require('../../assets/dark-icon.png')
                        : require('../../assets/icon.png')
                    }
                    style={{ width: 40, height: 40, marginRight: 8 }}
                  />
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.text }}>
                    Sevillaneando
                  </Text>
                </View>
              ),
            }}
          />

          <AppStack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Detalle del evento' }} />
          <AppStack.Screen name="EventDetailLink" component={EventDetailLinkScreen} options={{ title: 'Abriendo evento...' }} />
          <AppStack.Screen name="EventsMap" component={EventsMapScreen} options={{ title: 'Mapa de eventos', headerShown: false }} />

          {role === 'admin' && (
            <>
              <AppStack.Screen name="Admin" component={AdminScreen} options={{ title: 'Panel de Admin' }} />
              <AppStack.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Gestión de categorías' }} />
            </>
          )}

          <AppStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Editar perfil' }} />
          <AppStack.Screen name="EditPassword" component={EditPasswordScreen} options={{ title: 'Cambiar contraseña' }} />
          <AppStack.Screen name="CreateEvent" component={CreateEventScreen} options={{ title: 'Crear evento' }} />

          {role === 'moderator' && (
            <>
              <AppStack.Screen name="ModeratorEvents" component={ModeratorEventsScreen} options={{ title: 'Moderación' }} />
              <AppStack.Screen name="ModeratorEditEvent" component={ModeratorEditEventScreen} options={{ title: 'Editar evento' }} />
            </>
          )}

          <AppStack.Screen name="Notifications" component={NotificacionesScreen} options={{ title: 'Notificaciones' }} />
          <AppStack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Mensajes' }} />
          <AppStack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Perfil' }} />
          <AppStack.Screen name="DirectMessage" component={DirectMessageScreen} options={{ title: 'Mensaje privado' }} />
          <AppStack.Screen name="AccessPrivateEvent" component={AccessPrivateEventScreen} options={{ title: 'Acceso privado' }} />
          <AppStack.Screen name="EditEvent" component={UserEditEventScreen} options={{ title: 'Editar evento' }} />
          <AppStack.Screen name="UserEvents" component={UserEventsScreen} options={{ title: 'Mis eventos' }} />
          <AppStack.Screen name="CalendarEvents" component={CalendarEventsScreen} options={{ title: 'Calendario' }} />
          <AppStack.Screen name="RoutePreview" component={RoutePreviewScreen} options={{ title: 'Ruta recomendada' }} />
          <AppStack.Screen name="Routes" component={RoutesListScreen} options={{ title: 'Rutas' }} />
          <AppStack.Screen name="CreateRoute" component={CreateRouteScreen} options={{ title: 'Crear ruta' }} />
          <AppStack.Screen name="RouteDetail" component={RouteDetailScreen} options={{ title: 'Detalle de ruta' }} />
          <AppStack.Screen name="SavedAndPrivateEvents" component={SavedAndPrivateEventsScreen} options={{ title: '' }} />
          <AppStack.Screen name="LegalAttributions" component={LegalAttributionsScreen} options={{ title: 'Licencias y atribuciones' }} />
          <AppStack.Screen name="Friends" component={FriendsScreen} options={{ title: 'Amigos' }} />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="SignUp" component={SignUpScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
