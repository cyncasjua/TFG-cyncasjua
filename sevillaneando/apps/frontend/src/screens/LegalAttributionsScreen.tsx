import React from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText, ThemedTextSecondary, ThemedTitle, ThemedView } from '../components';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';

export const LegalAttributionsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      // Intentionally ignored: external browser may be unavailable.
    });
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedTitle style={styles.title}>{t('legal.title')}</ThemedTitle>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>{t('legal.osmTitle')}</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>{t('legal.osmData')}</ThemedTextSecondary>
          <ThemedTextSecondary style={styles.bodyText}>{t('legal.osmDesc')}</ThemedTextSecondary>
          <TouchableOpacity onPress={() => openUrl('https://www.openstreetmap.org/copyright')}>
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              {t('legal.osmLink')}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>{t('legal.nominatimTitle')}</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            {t('legal.nominatimDesc')}
          </ThemedTextSecondary>
          <TouchableOpacity
            onPress={() => openUrl('https://operations.osmfoundation.org/policies/nominatim/')}
          >
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              {t('legal.nominatimLink')}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>{t('legal.rnTitle')}</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>{t('legal.rnDesc')}</ThemedTextSecondary>
          <TouchableOpacity
            onPress={() => openUrl('https://github.com/facebook/react-native/blob/main/LICENSE')}
          >
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              {t('legal.rnLink')}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>{t('legal.nestTitle')}</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>{t('legal.nestDesc')}</ThemedTextSecondary>
          <TouchableOpacity
            onPress={() => openUrl('https://github.com/nestjs/nest/blob/master/LICENSE')}
          >
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              {t('legal.nestLink')}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>{t('legal.typeormTitle')}</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            {t('legal.typeormDesc')}
          </ThemedTextSecondary>
          <TouchableOpacity
            onPress={() => openUrl('https://github.com/typeorm/typeorm/blob/master/LICENSE')}
          >
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              {t('legal.typeormLink')}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>{t('legal.firebaseTitle')}</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            {t('legal.firebaseDesc')}
          </ThemedTextSecondary>
          <TouchableOpacity onPress={() => openUrl('https://firebase.google.com/terms')}>
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              {t('legal.firebaseLink')}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>{t('legal.cloudinaryTitle')}</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            {t('legal.cloudinaryDesc')}
          </ThemedTextSecondary>
          <TouchableOpacity onPress={() => openUrl('https://cloudinary.com/tos')}>
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              {t('legal.cloudinaryLink')}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>{t('legal.ticketmasterTitle')}</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            {t('legal.ticketmasterDesc')}
          </ThemedTextSecondary>
          <TouchableOpacity
            onPress={() => openUrl('https://developer.ticketmaster.com/support/terms-of-use/')}
          >
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              {t('legal.ticketmasterLink')}
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  title: {
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  bodyText: {
    lineHeight: 20,
  },
  link: {
    fontWeight: '700',
  },
});
