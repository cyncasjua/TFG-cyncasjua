import React, { useCallback, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  View,
  Image,
  TouchableOpacity,
} from 'react-native';
import dayjs from 'dayjs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api, getErrorMessage } from '../services';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ThemedView, ThemedText, ThemedTextSecondary, ThemedTitle } from '../components';
import { getFullImageUrl } from '../utils/imageUrl';
import type { RootStackParamList } from '../navigation/types';
import type { Event } from '../types/event';
import { useTranslation } from 'react-i18next';

export const UserEventsScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'UserEvents'>>();

  const [events, setEvents] = useState<Event[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchUserEvents = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`/events/user/${user.id}`);
      const allEvents: Event[] = res.data;
      // Eventos públicos pendientes están en moderación: no mostrarlos
      const visible = allEvents.filter(
        (e) => e.privado || e.estado === 'Aprobado' || e.estado === 'Rechazado'
      );
      const pending = allEvents.filter((e) => !e.privado && e.estado === 'Pendiente').length;
      setEvents(visible);
      setPendingCount(pending);
    } catch (err) {
      Alert.alert(t('common.error'), getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchUserEvents();
    }, [fetchUserEvents])
  );

  const handleEdit = (event: Event) => {
    navigation.navigate('EditEvent', { event });
  };

  if (!user?.id) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>{t('userEvents.loginRequired')}</ThemedText>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedTextSecondary style={{ marginTop: 8 }}>{t('userEvents.loading')}</ThemedTextSecondary>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedTitle style={styles.title}>{t('userEvents.title')}</ThemedTitle>
      <ThemedView
        style={[
          styles.infoBox,
          { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' },
        ]}
      >
        <Icon
          name="information-outline"
          size={18}
          color={colors.primary}
          style={{ marginTop: 1 }}
        />
        <ThemedTextSecondary style={styles.infoText}>
          {t('userEvents.infoMsg')}
        </ThemedTextSecondary>
      </ThemedView>
      {pendingCount > 0 && (
        <ThemedView
          style={[styles.infoBox, { backgroundColor: '#e6740018', borderColor: '#e6740044' }]}
        >
          <Icon name="clock-outline" size={18} color="#e67400" style={{ marginTop: 1 }} />
          <ThemedTextSecondary style={styles.infoText}>
            Tienes{' '}
            <ThemedText style={[styles.infoHighlight, { color: '#e67400' }]}>
              {pendingCount} {pendingCount === 1 ? t('userEvents.publicSingular') : t('userEvents.publicPlural')}
            </ThemedText>{' '}
            {pendingCount === 1 ? t('userEvents.pendingSingular') : t('userEvents.pendingPlural')} de moderación. No{' '}
            {pendingCount === 1 ? t('userEvents.appearsSingular') : t('userEvents.appearsPlural')} aquí hasta que{' '}
            {pendingCount === 1 ? t('userEvents.approvedSingular') : t('userEvents.approvedPlural')}.
          </ThemedTextSecondary>
        </ThemedView>
      )}
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => handleEdit(item)} activeOpacity={0.8}>
            <ThemedView
              style={[
                styles.card,
                {
                  backgroundColor: theme === 'dark' ? '#222' : '#fff',
                  borderColor: theme === 'dark' ? colors.primary : '#eee',
                  shadowColor: theme === 'dark' ? '#000' : '#aaa',
                },
              ]}
            >
              <View style={{ position: 'relative' }}>
                <Image
                  source={
                    getFullImageUrl(item.imagen)
                      ? { uri: getFullImageUrl(item.imagen)! }
                      : require('../../assets/splash.png')
                  }
                  style={styles.image}
                  resizeMode="cover"
                />
                {item.estado === 'Rechazado' && (
                  <View style={[styles.estadoBadge, { backgroundColor: '#d32f2f' }]}>
                    <Icon name="close-circle-outline" size={13} color="#fff" />
                    <ThemedText style={styles.estadoBadgeText}>{t('userEvents.rejected')}</ThemedText>
                  </View>
                )}
                {item.estado === 'Aprobado' && !item.privado && (
                  <View style={[styles.estadoBadge, { backgroundColor: '#4caf50' }]}>
                    <Icon name="check-circle-outline" size={13} color="#fff" />
                    <ThemedText style={styles.estadoBadgeText}>{t('userEvents.approved')}</ThemedText>
                  </View>
                )}
                {item.privado && (
                  <View style={[styles.estadoBadge, { backgroundColor: '#5c6bc0' }]}>
                    <Icon name="lock-outline" size={13} color="#fff" />
                    <ThemedText style={styles.estadoBadgeText}>{t('userEvents.private')}</ThemedText>
                  </View>
                )}
              </View>
              <ThemedText style={styles.eventTitle}>{item.title}</ThemedText>
              <ThemedText style={styles.eventDesc} numberOfLines={2}>
                {item.description}
              </ThemedText>

              <ThemedTextSecondary style={styles.eventInfo}>
                {t('userEvents.dateLabel')}{' '}
                {item.fechaInicio
                  ? dayjs(item.fechaInicio).format('YYYY/MM/DD HH:mm')
                  : t('userEvents.undefinedDate')}
              </ThemedTextSecondary>

              <ThemedTextSecondary style={styles.eventInfo}>
                {t('userEvents.locationLabel')} {item.address}
              </ThemedTextSecondary>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.editButton, { backgroundColor: colors.primary }]}
                  onPress={() => handleEdit(item)}
                >
                  <Icon name="pencil" size={18} color="#fff" />
                  <ThemedText style={styles.buttonText}>{t('common.edit')}</ThemedText>
                </TouchableOpacity>
              </View>
            </ThemedView>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="calendar-plus-outline" size={48} color={colors.text + '44'} />
            <ThemedTextSecondary style={styles.emptyText}>
              {t('userEvents.empty')}
            </ThemedTextSecondary>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: '#ccc',
  },
  eventTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 6 },
  eventDesc: { fontSize: 15, marginBottom: 8 },
  eventInfo: { fontSize: 13, marginBottom: 2 },
  actions: { marginTop: 14, flexDirection: 'row', justifyContent: 'flex-end' },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
  infoHighlight: { fontWeight: '700' },
  estadoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  estadoBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { textAlign: 'center', fontSize: 15, opacity: 0.6, lineHeight: 22 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default UserEventsScreen;
