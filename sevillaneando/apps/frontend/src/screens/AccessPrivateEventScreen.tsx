import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { ThemedView, ThemedText, ThemedButton } from '../components';
import { useTheme } from '../hooks/useTheme';
import { getErrorMessage, getEventByAccessLink } from '../services';
import { Event } from '../types/event';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<RootStackParamList, 'AccessPrivateEvent'>;

const ACCESSED_PRIVATE_LINKS_KEY = 'accessedPrivateLinks';

export const AccessPrivateEventScreen: React.FC<Props> = ({ route, navigation }) => {
  const { linkAcceso } = route.params;
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { colors } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const loadedEvent = await getEventByAccessLink(linkAcceso);
        setEvent(loadedEvent);

        const raw = await AsyncStorage.getItem(ACCESSED_PRIVATE_LINKS_KEY);
        const links: string[] = raw ? JSON.parse(raw) : [];
        if (!links.includes(linkAcceso)) {
          links.push(linkAcceso);
          await AsyncStorage.setItem(ACCESSED_PRIVATE_LINKS_KEY, JSON.stringify(links));
        }
      } catch (err) {
        setError(getErrorMessage(err) || t('accessPrivateEvent.loadError'));
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [linkAcceso]);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

  if (error || !event) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={styles.errorText}>{t('accessPrivateEvent.errorPrefix')} {error}</ThemedText>
        <ThemedButton onPress={() => navigation.goBack()} title={t('common.back')} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>{event.title}</ThemedText>
      <View style={styles.buttons}>
        <ThemedButton
          variant="secondary"
          onPress={() => navigation.goBack()}
          title={t('common.back')}
          style={[styles.btn, { borderColor: colors.primary }]}
        />
        <ThemedButton
          onPress={() => navigation.navigate('EventDetail', { event })}
          title={t('accessPrivateEvent.viewFull')}
          style={styles.btn}
        />
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 16,
    color: 'red',
  },
});
