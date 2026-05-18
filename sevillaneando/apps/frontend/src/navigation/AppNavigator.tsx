import React from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

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
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import HelpScreen from '../screens/HelpScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ProfileConnectionsScreen } from '../screens/ProfileConnectionsScreen';

const AppStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

export function AppNavigator() {
  const { user, loading, role } = useAuth();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

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
        <Text style={{ marginTop: 8, color: colors.text }}>{t('nav.checkingSession')}</Text>
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

          <AppStack.Screen
            name="EventDetail"
            component={EventDetailScreen}
            options={{ title: t('nav.eventDetail') }}
          />
          <AppStack.Screen
            name="EventDetailLink"
            component={EventDetailLinkScreen}
            options={{ title: t('nav.openingEvent') }}
          />
          <AppStack.Screen
            name="EventsMap"
            component={EventsMapScreen}
            options={{ title: t('nav.eventsMap'), headerShown: false }}
          />

          {role === 'admin' && (
            <>
              <AppStack.Screen
                name="Admin"
                component={AdminScreen}
                options={{ title: t('nav.admin') }}
              />
              <AppStack.Screen
                name="Categories"
                component={CategoriesScreen}
                options={{ title: t('nav.categories') }}
              />
            </>
          )}

          <AppStack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ title: t('nav.editProfile') }}
          />
          <AppStack.Screen
            name="EditPassword"
            component={EditPasswordScreen}
            options={{ title: t('nav.editPassword') }}
          />
          <AppStack.Screen
            name="CreateEvent"
            component={CreateEventScreen}
            options={{ title: t('nav.createEvent') }}
          />

          {role === 'moderator' && (
            <>
              <AppStack.Screen
                name="ModeratorEvents"
                component={ModeratorEventsScreen}
                options={{ title: t('nav.moderation') }}
              />
              <AppStack.Screen
                name="ModeratorEditEvent"
                component={ModeratorEditEventScreen}
                options={{ title: t('nav.editEvent') }}
              />
            </>
          )}

          <AppStack.Screen
            name="Notifications"
            component={NotificacionesScreen}
            options={{ title: t('nav.notifications') }}
          />
          <AppStack.Screen
            name="Messages"
            component={MessagesScreen}
            options={{ title: t('nav.messages') }}
          />
          <AppStack.Screen
            name="UserProfile"
            component={UserProfileScreen}
            options={{ title: t('nav.profile') }}
          />
          <AppStack.Screen
            name="DirectMessage"
            component={DirectMessageScreen}
            options={{ title: t('nav.directMessage') }}
          />
          <AppStack.Screen
            name="AccessPrivateEvent"
            component={AccessPrivateEventScreen}
            options={{ title: t('nav.privateAccess') }}
          />
          <AppStack.Screen
            name="EditEvent"
            component={UserEditEventScreen}
            options={{ title: t('nav.editEvent') }}
          />
          <AppStack.Screen
            name="UserEvents"
            component={UserEventsScreen}
            options={{ title: t('nav.myEvents') }}
          />
          <AppStack.Screen
            name="CalendarEvents"
            component={CalendarEventsScreen}
            options={{ title: t('nav.calendar') }}
          />
          <AppStack.Screen
            name="RoutePreview"
            component={RoutePreviewScreen}
            options={{ title: t('nav.recommendedRoute') }}
          />
          <AppStack.Screen
            name="Routes"
            component={RoutesListScreen}
            options={{ title: t('nav.routes') }}
          />
          <AppStack.Screen
            name="CreateRoute"
            component={CreateRouteScreen}
            options={{ title: t('nav.createRoute') }}
          />
          <AppStack.Screen
            name="RouteDetail"
            component={RouteDetailScreen}
            options={{ title: t('nav.routeDetail') }}
          />
          <AppStack.Screen
            name="SavedAndPrivateEvents"
            component={SavedAndPrivateEventsScreen}
            options={{ title: '' }}
          />
          <AppStack.Screen
            name="LegalAttributions"
            component={LegalAttributionsScreen}
            options={{ title: t('nav.legalAttributions') }}
          />
          <AppStack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{ title: t('nav.privacyPolicy') }}
          />
          <AppStack.Screen name="Help" component={HelpScreen} options={{ title: t('nav.help') }} />
          <AppStack.Screen name="Friends" component={FriendsScreen} options={{ title: t('nav.friends') }} />
          <AppStack.Screen
            name="ProfileConnections"
            component={ProfileConnectionsScreen}
            options={{ title: t('nav.users') }}
          />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="SignUp" component={SignUpScreen} />
          <AuthStack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{ headerShown: true, title: t('nav.privacyPolicy') }}
          />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
