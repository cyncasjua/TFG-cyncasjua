import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { ThemedView, ThemedText, ThemedButton } from '../components';
import { useTheme } from '../hooks/useTheme';
import { getErrorMessage, getEventByAccessLink } from '../services/api';
import { Event } from '../types/event';

type Props = NativeStackScreenProps<RootStackParamList, 'AccessPrivateEvent'>;

const ACCESSED_PRIVATE_LINKS_KEY = 'accessedPrivateLinks';

export const AccessPrivateEventScreen: React.FC<Props> = ({ route, navigation }) => {
  const { linkAcceso } = route.params;
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { colors } = useTheme();


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
        setError(getErrorMessage(err) || 'No se pudo cargar el evento privado');
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
        <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
        <ThemedButton
          onPress={() => navigation.goBack()}
          title="Volver"
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>{event.title}</ThemedText>
      <ThemedButton
        onPress={() => navigation.navigate('EventDetail', { event })}
        title="Ver evento completo"
      />
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
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 16,
    color: 'red',
  },
});
