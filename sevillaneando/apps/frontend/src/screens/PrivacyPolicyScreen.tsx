import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ThemedText, ThemedTextSecondary, ThemedTitle, ThemedView } from '../components';
import { useTheme } from '../hooks/useTheme';

export const PrivacyPolicyScreen: React.FC = () => {
  const { colors } = useTheme();

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedTitle style={styles.title}>Política de privacidad</ThemedTitle>
        <ThemedTextSecondary style={styles.updated}>
          Última actualización: mayo de 2025
        </ThemedTextSecondary>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>1. Responsable del tratamiento</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            Sevillaneando es una aplicación académica desarrollada como Trabajo de Fin de Grado
            (TFG) en la Universidad de Sevilla. Los datos recogidos se tratan únicamente con fines
            demostrativos y académicos.
          </ThemedTextSecondary>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>2. Datos que recogemos</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            Al registrarte y usar la aplicación podemos tratar los siguientes datos personales:
          </ThemedTextSecondary>
          <ThemedTextSecondary style={styles.bodyText}>
            • Nombre y dirección de correo electrónico (registro){'\n'}• Fotografía de perfil
            (opcional){'\n'}• Ubicación geográfica (opcional, para búsqueda de eventos cercanos)
            {'\n'}• Intereses culturales seleccionados{'\n'}• Contenido generado: eventos, rutas,
            reseñas y mensajes de chat
          </ThemedTextSecondary>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>3. Finalidad y base legal</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            Tratamos tus datos para:{'\n'}• Gestionar tu cuenta y autenticación{'\n'}• Mostrarte
            eventos culturales relevantes en Sevilla{'\n'}• Permitirte crear y compartir rutas y
            reseñas{'\n'}• Facilitar la comunicación entre usuarios (chat)
          </ThemedTextSecondary>
          <ThemedTextSecondary style={styles.bodyText}>
            La base legal del tratamiento es tu consentimiento expreso (art. 6.1.a RGPD), otorgado
            al aceptar esta política durante el registro.
          </ThemedTextSecondary>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>4. Terceros que procesan tus datos</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            Para prestar el servicio utilizamos los siguientes proveedores externos, cada uno con su
            propia política de privacidad:{'\n'}• Firebase (Google LLC) — autenticación y
            almacenamiento de archivos{'\n'}• Cloudinary — alojamiento de imágenes{'\n'}•
            Ticketmaster — datos de eventos culturales públicos{'\n'}• Google Gemini —
            enriquecimiento de información de eventos{'\n'}• OpenStreetMap / Nominatim — mapas y
            geocodificación
          </ThemedTextSecondary>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>5. Conservación de los datos</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            Tus datos se conservan mientras tu cuenta esté activa. Al eliminar tu cuenta, tus datos
            de perfil y contenido asociado se eliminarán o anonimizarán de forma permanente en un
            plazo máximo de 30 días.
          </ThemedTextSecondary>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>6. Tus derechos</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            De acuerdo con el RGPD (Reglamento UE 2016/679) tienes derecho a:{'\n'}• Acceder a tus
            datos personales{'\n'}• Rectificar datos inexactos{'\n'}• Suprimir tus datos (derecho al
            olvido){'\n'}• Portabilidad de tus datos{'\n'}• Retirar el consentimiento en cualquier
            momento
          </ThemedTextSecondary>
          <ThemedTextSecondary style={styles.bodyText}>
            Puedes ejercer estos derechos eliminando tu cuenta desde el perfil de la aplicación o
            contactando con el responsable del proyecto.
          </ThemedTextSecondary>
        </ThemedView>

        <ThemedView
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ThemedText style={styles.sectionTitle}>7. Seguridad</ThemedText>
          <ThemedTextSecondary style={styles.bodyText}>
            Aplicamos medidas técnicas para proteger tus datos: comunicaciones cifradas mediante
            HTTPS/TLS, autenticación mediante Firebase, validación de entradas y limitación de
            solicitudes (rate limiting).
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
