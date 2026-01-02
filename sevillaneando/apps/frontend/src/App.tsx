import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LogBox } from 'react-native';
import { HomeScreen } from './screens/HomeScreen';
import { EventDetailScreen } from './screens/EventDetailScreen';
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
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const App = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Sevillaneando' }} />
        <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Detalle del evento' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
