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

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>OpenStreetMap</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            Map data © OpenStreetMap contributors, ODbL 1.0.
          </ThemedTextSecondary>
          <ThemedTextSecondary style={styles.bodyText}>
            Esta app usa datos de OpenStreetMap y debe mantener atribución visible en pantallas de
            mapa.
          </ThemedTextSecondary>
          <TouchableOpacity onPress={() => openUrl('https://www.openstreetmap.org/copyright')}>
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              Ver aviso oficial de copyright
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>Nominatim (geocodificación)</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            Se usa Nominatim para búsquedas de direcciones y geocodificación inversa.
          </ThemedTextSecondary>
          <TouchableOpacity
            onPress={() => openUrl('https://operations.osmfoundation.org/policies/nominatim/')}
          >
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              Política de uso de Nominatim
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>React Native / Expo</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            Esta app está construida con React Native y Expo, distribuidos bajo la licencia MIT.
          </ThemedTextSecondary>
          <TouchableOpacity
            onPress={() => openUrl('https://github.com/facebook/react-native/blob/main/LICENSE')}
          >
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              Licencia MIT — React Native
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>NestJS</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            El servidor de esta aplicación está desarrollado con NestJS, distribuido bajo la
            licencia MIT.
          </ThemedTextSecondary>
          <TouchableOpacity
            onPress={() => openUrl('https://github.com/nestjs/nest/blob/master/LICENSE')}
          >
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              Licencia MIT — NestJS
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>TypeORM</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            La capa de acceso a datos del servidor usa TypeORM, distribuido bajo la licencia MIT.
          </ThemedTextSecondary>
          <TouchableOpacity
            onPress={() => openUrl('https://github.com/typeorm/typeorm/blob/master/LICENSE')}
          >
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              Licencia MIT — TypeORM
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>Firebase</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            La autenticación de usuarios se gestiona a través de Firebase (Google LLC), sujeto a los
            Términos de Servicio de Firebase.
          </ThemedTextSecondary>
          <TouchableOpacity onPress={() => openUrl('https://firebase.google.com/terms')}>
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              Términos de Servicio de Firebase
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>Cloudinary</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            Las imágenes de la app se almacenan y sirven a través de Cloudinary, sujeto a sus
            Términos de Servicio.
          </ThemedTextSecondary>
          <TouchableOpacity onPress={() => openUrl('https://cloudinary.com/tos')}>
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              Términos de Servicio de Cloudinary
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>Ticketmaster API</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            Algunos eventos se obtienen a través de la API de Ticketmaster, sujeto a sus Términos de
            Uso.
          </ThemedTextSecondary>
          <TouchableOpacity
            onPress={() => openUrl('https://developer.ticketmaster.com/support/terms-of-use/')}
          >
            <ThemedText style={[styles.link, { color: colors.primary }]}>
              Términos de Uso — Ticketmaster Developer
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
