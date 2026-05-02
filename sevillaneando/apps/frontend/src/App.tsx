import React from 'react';
import { LogBox } from 'react-native';

import { AppProviders } from './providers/AppProviders';
import { AppNavigator } from './navigation/AppNavigator';

LogBox.ignoreLogs([
  'You are initializing Firebase Auth',
  'Non-serializable values were found in the navigation state',
]);

export default function App() {
  return (
    <AppProviders>
      <AppNavigator />
    </AppProviders>
  );
}
