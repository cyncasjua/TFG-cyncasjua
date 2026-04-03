import React from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText, ThemedTextSecondary, ThemedTitle, ThemedView } from '../components';
import { useTheme } from '../hooks/useTheme';

export const LegalAttributionsScreen: React.FC = () => {
  const { colors } = useTheme();

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {
      // Intentionally ignored: external browser may be unavailable.
    });
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedTitle style={styles.title}>Licencias y atribuciones</ThemedTitle>

        <ThemedView style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ThemedText style={styles.sectionTitle}>OpenStreetMap</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            Map data © OpenStreetMap contributors, ODbL 1.0.
          </ThemedTextSecondary>
          <ThemedTextSecondary style={styles.bodyText}>
            Esta app usa datos de OpenStreetMap y debe mantener atribución visible en pantallas de mapa.
          </ThemedTextSecondary>
          <TouchableOpacity onPress={() => openUrl('https://www.openstreetmap.org/copyright')}>
            <ThemedText style={[styles.link, { color: colors.primary }]}>Ver aviso oficial de copyright</ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ThemedText style={styles.sectionTitle}>Nominatim (geocodificación)</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            Se usa Nominatim para búsquedas de direcciones y geocodificación inversa.
          </ThemedTextSecondary>
          <TouchableOpacity onPress={() => openUrl('https://operations.osmfoundation.org/policies/nominatim/')}>
            <ThemedText style={[styles.link, { color: colors.primary }]}>Política de uso de Nominatim</ThemedText>
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
    borderRadius: 12,
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
