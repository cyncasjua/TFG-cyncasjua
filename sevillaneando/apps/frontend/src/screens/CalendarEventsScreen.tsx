import React, { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Alert, FlatList, View, StyleSheet } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useAuth } from '../hooks/useAuth';
import { ThemedView, ThemedText } from '../components';
import { api } from '../services/api';
import { Event } from '../types/event';
import { useTheme } from '../hooks/useTheme';
import { TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { formatSevillaTime, getSevillaDayKey } from '../utils/sevillaTime';

export const CalendarEventsScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(getSevillaDayKey(new Date()));

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    api.get(`/events/attending/${user.id}`)
      .then(res => setEvents(res.data))
      .catch(() => Alert.alert('Error', 'No se pudieron cargar tus eventos.'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const markedDates = useMemo(() => {
    const marks: any = {};
    events.forEach(event => {
      const date = getSevillaDayKey(event.fechaInicio);
      marks[date] = {
        marked: true,
        dotColor: '#6c2eb7'
      };
    });

    marks[selectedDate] = {
      ...marks[selectedDate],
      selected: true,
      selectedColor: '#6c2eb7',
    };
    return marks;
  }, [events, selectedDate]);

  const eventsForSelectedDate = useMemo(() => {
    return events.filter(event => getSevillaDayKey(event.fechaInicio) === selectedDate);
  }, [events, selectedDate]);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color="#6c2eb7" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1, backgroundColor: colors.background }}>
      <Calendar
        onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
        markedDates={markedDates}
        theme={{
          backgroundColor: colors.background,
          calendarBackground: colors.background,
          textSectionTitleColor: theme === 'dark' ? '#aaa' : '#b6c1cd',
          selectedDayBackgroundColor: colors.primary,
          selectedDayTextColor: '#fff',
          todayTextColor: colors.primary,
          dayTextColor: colors.text,
          textDisabledColor: theme === 'dark' ? '#444' : '#d9e1e8',
          dotColor: colors.primary,
          selectedDotColor: '#fff',
          arrowColor: colors.primary,
          monthTextColor: colors.text,
          indicatorColor: colors.primary,
          textDayFontWeight: '500',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '500',
          textDayFontSize: 16,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 14,
        }}
      />

      <ThemedView style={[styles.eventsContainer, { backgroundColor: colors.background }]}>
        <ThemedText style={styles.title}>
          Eventos para el {selectedDate}
        </ThemedText>

        <FlatList
          data={eventsForSelectedDate}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('EventDetail', { event: item })}
              activeOpacity={0.8}
            >
              <View style={[styles.eventCard, { backgroundColor: colors.card }]}>
                <ThemedText style={styles.eventTitle}>{item.title}</ThemedText>
                <ThemedText style={styles.eventSubtitle}>📍 {item.address}</ThemedText>
                <ThemedText style={styles.eventTime}>
                  🗓️ {formatSevillaTime(item.fechaInicio)}
                </ThemedText>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <ThemedText style={styles.emptyText}>No tienes eventos para este día.</ThemedText>
          }
        />
      </ThemedView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  eventsContainer: { flex: 1, padding: 20, borderTopWidth: 1, borderTopColor: '#eee' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  eventCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  eventTitle: { fontWeight: 'bold', fontSize: 16 },
  eventSubtitle: { color: '#666', fontSize: 14, marginTop: 4 },
  eventTime: { color: '#6c2eb7', fontSize: 12, marginTop: 4, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 20 }
});

export default CalendarEventsScreen;
