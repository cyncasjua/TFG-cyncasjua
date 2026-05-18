import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ThemedText, ThemedTextSecondary, ThemedTitle, ThemedView } from '../components';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';

export const PrivacyPolicyScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedTitle style={styles.title}>{t('privacy.title')}</ThemedTitle>
        <ThemedTextSecondary style={styles.updated}>{t('privacy.lastUpdated')}</ThemedTextSecondary>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>{t('privacy.section1Title')}</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            {t('privacy.section1Body')}
          </ThemedTextSecondary>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>{t('privacy.section2Title')}</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            {t('privacy.section2Intro')}
          </ThemedTextSecondary>
          <ThemedTextSecondary style={styles.bodyText}>
            {t('privacy.section2Body')}
          </ThemedTextSecondary>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>{t('privacy.section3Title')}</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            {t('privacy.section3Body')}
          </ThemedTextSecondary>
          <ThemedTextSecondary style={styles.bodyText}>
            {t('privacy.section3Legal')}
          </ThemedTextSecondary>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>{t('privacy.section4Title')}</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            {t('privacy.section4Body')}
          </ThemedTextSecondary>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>{t('privacy.section5Title')}</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            {t('privacy.section5Body')}
          </ThemedTextSecondary>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>{t('privacy.section6Title')}</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            {t('privacy.section6Body')}
          </ThemedTextSecondary>
          <ThemedTextSecondary style={styles.bodyText}>
            {t('privacy.section6Footer')}
          </ThemedTextSecondary>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>{t('privacy.section7Title')}</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            {t('privacy.section7Body')}
          </ThemedTextSecondary>
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
    marginBottom: 4,
  },
  updated: {
    marginBottom: 8,
    fontSize: 12,
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
});
