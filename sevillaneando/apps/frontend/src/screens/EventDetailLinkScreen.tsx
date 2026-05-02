import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getErrorMessage, getEventById } from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EventDetailLink'>;

export function EventDetailLinkScreen({ route, navigation }: Props) {
  const [error, setError] = React.useState<string | null>(null);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    let isMounted = true;

    getEventById(route.params.eventId)
      .then((event) => {
        if (!isMounted) return;
        navigation.replace('EventDetail', { event });
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(getErrorMessage(err) || 'No se pudo abrir el evento.');
      });

    return () => {
      isMounted = false;
    };
  }, [navigation, route.params.eventId]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
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
    </View>
  );
}
