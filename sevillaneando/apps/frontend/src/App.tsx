import React, { useEffect, useState } from 'react';
import { LogBox } from 'react-native';

import { AppProviders } from './providers/AppProviders';
import { AppNavigator } from './navigation/AppNavigator';
import { initI18n } from './i18n/i18n';

LogBox.ignoreLogs([
  'You are initializing Firebase Auth',
  'Non-serializable values were found in the navigation state',
]);

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  if (!i18nReady) return null;

  return (
    <AppProviders>
      <AppNavigator />
    </AppProviders>
  );
}
