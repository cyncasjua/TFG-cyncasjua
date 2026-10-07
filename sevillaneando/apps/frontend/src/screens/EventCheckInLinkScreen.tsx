import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { attendEvent, getErrorMessage, getEventById } from '../services';
import type { RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<RootStackParamList, 'EventCheckInLink'>;

export function EventCheckInLinkScreen({ route, navigation }: Props) {
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const { t } = useTranslation();

  React.useEffect(() => {
    let isMounted = true;

    const runCheckIn = async () => {
      try {
        await attendEvent(route.params.eventId);

        try {
          const event = await getEventById(route.params.eventId);
          if (!isMounted) return;
          navigation.replace('EventDetail', { event });
          return;
        } catch {
          if (!isMounted) return;
          setMessage(t('eventCheckIn.success'));
        }
      } catch (err) {
        if (!isMounted) return;
        setError(getErrorMessage(err) || t('eventCheckIn.error'));
      }
    };

    runCheckIn();

    return () => {
      isMounted = false;
    };
  }, [navigation, route.params.eventId, t]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {!error && !message ? (
        <>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 8 }}>{t('eventCheckIn.loading')}</Text>
        </>
      ) : error ? (
        <Text>{error}</Text>
      ) : (
        <>
          <Text style={{ textAlign: 'center' }}>{message}</Text>
          <Text style={{ marginTop: 8, textAlign: 'center' }}>{t('eventCheckIn.doneHint')}</Text>
        </>
      )}
    </View>
  );
}
