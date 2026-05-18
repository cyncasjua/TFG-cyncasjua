import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ThemedText, ThemedTextSecondary, ThemedView } from '../components';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';

type Section = {
  icon: string;
  title: string;
  content: string;
};

export const HelpScreen: React.FC = () => {
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<number | null>(null);

  const SECTIONS: Section[] = [
    { icon: 'calendar-plus-outline', title: t('help.createEventTitle'), content: t('help.createEventBody') },
    { icon: 'currency-eur', title: t('help.priceTitle'), content: t('help.priceBody') },
    { icon: 'repeat', title: t('help.recurrenceTitle'), content: t('help.recurrenceBody') },
    { icon: 'lock-outline', title: t('help.privateTitle'), content: t('help.privateBody') },
    { icon: 'shield-check-outline', title: t('help.moderationTitle'), content: t('help.moderationBody') },
    { icon: 'bookmark-outline', title: t('help.saveTitle'), content: t('help.saveBody') },
    { icon: 'calendar-check-outline', title: t('help.attendTitle'), content: t('help.attendBody') },
    { icon: 'calendar-month-outline', title: t('help.calendarTitle'), content: t('help.calendarBody') },
    { icon: 'map-search-outline', title: t('help.mapTitle'), content: t('help.mapBody') },
    { icon: 'tag-multiple-outline', title: t('help.categoriesTitle'), content: t('help.categoriesBody') },
    { icon: 'map-marker-path', title: t('help.routesTitle'), content: t('help.routesBody') },
    { icon: 'account-cog-outline', title: t('help.profileTitle'), content: t('help.profileBody') },
    { icon: 'account-group-outline', title: t('help.friendsTitle'), content: t('help.friendsBody') },
    { icon: 'star-outline', title: t('help.rateTitle'), content: t('help.rateBody') },
    { icon: 'chat-outline', title: t('help.chatTitle'), content: t('help.chatBody') },
    { icon: 'message-question-outline', title: t('help.contactTitle'), content: t('help.contactBody') },
  ];

  const toggle = (i: number) => setExpanded((prev) => (prev === i ? null : i));

  return (
    <ThemedView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedTextSecondary style={styles.intro}>
          {t('help.intro')}
        </ThemedTextSecondary>

        {SECTIONS.map((section, i) => {
          const isOpen = expanded === i;
          return (
            <View
              key={i}
              style={[
                styles.card,
                {
                  backgroundColor: theme === 'dark' ? '#222' : '#fff',
                  borderColor: isOpen ? colors.primary : theme === 'dark' ? '#333' : '#eee',
                },
              ]}
            >
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => toggle(i)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconWrap, { backgroundColor: colors.primary + '22' }]}>
                  <Icon name={section.icon} size={22} color={colors.primary} />
                </View>
                <ThemedText style={styles.cardTitle}>{section.title}</ThemedText>
                <Icon
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color={colors.text + '66'}
                />
              </TouchableOpacity>

              {isOpen && (
                <View style={[styles.cardBody, { borderTopColor: colors.border ?? '#eee' }]}>
                  <ThemedTextSecondary style={styles.cardText}>
                    {section.content}
                  </ThemedTextSecondary>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  intro: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, fontWeight: '600', fontSize: 15 },
  cardBody: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardText: { fontSize: 14, lineHeight: 22 },
});

export default HelpScreen;
