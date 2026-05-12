import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { ThemedText, ThemedTextSecondary, ThemedView } from '../components';
import { useTheme } from '../hooks/useTheme';

type Section = {
  icon: string;
  title: string;
  content: string;
};

const SECTIONS: Section[] = [
  {
    icon: 'calendar-plus-outline',
    title: 'Crear un evento',
    content:
      'Al crear un evento puedes elegir si es público o privado.\n\n' +
      '• Los eventos públicos se envían a moderación antes de aparecer en la app. Una vez aprobados, cualquier usuario puede verlos y apuntarse.\n\n' +
      '• Los eventos privados son solo para ti y las personas con las que compartas el enlace. No pasan por moderación y no son visibles en el mapa ni en el listado general.\n\n' +
      'La fecha de inicio y fin es opcional. Si no se indica, el evento aparece como "Indefinido".',
  },
  {
    icon: 'currency-eur',
    title: 'Precio de un evento',
    content:
      'Al crear o editar un evento debes indicar el precio. Hay dos opciones, no ambas a la vez:\n\n' +
      '• Precio fijo: un único valor en €. Pon 0 si el evento es gratuito.\n\n' +
      '• Rango de precio: un mínimo y un máximo (por ejemplo, entradas de 10 € a 25 €). Ambos campos son obligatorios si usas esta opción.',
  },
  {
    icon: 'repeat',
    title: 'Eventos recurrentes',
    content:
      'Al crear un evento puedes indicar si se repite: diario, semanal, quincenal o mensual.\n\n' +
      'Si activas la recurrencia, también puedes fijar una fecha límite hasta la que se repite el evento. Sin fecha límite, la recurrencia es indefinida.\n\n' +
      'Los eventos recurrentes se muestran como un único evento en la app; la recurrencia es solo informativa.',
  },
  {
    icon: 'lock-outline',
    title: 'Eventos privados y enlace de acceso',
    content:
      'Cuando creas un evento privado, la app genera un enlace único de acceso.\n\n' +
      'Puedes compartir ese enlace con quien quieras. Quien lo abra podrá ver el evento y apuntarse.\n\n' +
      'El enlace se puede copiar desde la pantalla de detalle del evento, en el botón "Compartir enlace privado".\n\n' +
      'Los eventos a los que te hayas unido por enlace aparecen en el menú → "Eventos apuntados".',
  },
  {
    icon: 'shield-check-outline',
    title: 'Moderación de eventos',
    content:
      'Los eventos públicos pasan por un proceso de moderación antes de publicarse.\n\n' +
      '• Un moderador puede aprobarlos o rechazarlos desde "Aprobar eventos" en el menú.\n\n' +
      '• Una vez aprobado, el evento aparece en el mapa y el listado para todos los usuarios.\n\n' +
      '• Los moderadores también pueden editar los datos de cualquier evento público ya aprobado.\n\n' +
      '• Los eventos privados no pasan por moderación y no son visibles ni editables por los moderadores.',
  },
  {
    icon: 'bookmark-outline',
    title: 'Guardar eventos',
    content:
      'Puedes guardar cualquier evento público pulsando el icono de marcador en la pantalla de detalle.\n\n' +
      'Los eventos guardados aparecen en el menú → "Eventos guardados". Esto te permite tener una lista de eventos de interés sin necesidad de apuntarte.',
  },
  {
    icon: 'calendar-check-outline',
    title: 'Apuntarse a un evento',
    content:
      'Puedes apuntarte a un evento público desde su pantalla de detalle. Los eventos a los que estás apuntado aparecen en el menú → "Eventos apuntados".\n\n' +
      'También puedes ver todos tus eventos apuntados en formato calendario desde el menú → "Calendario". Los días con eventos aparecen marcados y puedes pulsar en cualquier día para ver los eventos de esa fecha.',
  },
  {
    icon: 'calendar-month-outline',
    title: 'Calendario',
    content:
      'El calendario muestra todos los eventos a los que estás apuntado organizados por día.\n\n' +
      'Los días con eventos aparecen marcados. Al pulsar un día se muestra la lista de eventos de esa fecha. Puedes pulsar cualquier evento para ver su detalle.',
  },
  {
    icon: 'map-search-outline',
    title: 'Mapa de eventos',
    content:
      'Desde el menú → "Mapa de eventos" puedes ver todos los eventos públicos aprobados situados en el mapa de Sevilla.\n\n' +
      'Puedes filtrar por categoría y por radio de distancia desde tu ubicación. Al pulsar un marcador se muestra un resumen del evento; pulsa de nuevo para ver el detalle completo.',
  },
  {
    icon: 'tag-multiple-outline',
    title: 'Categorías',
    content:
      'Las categorías sirven para clasificar los eventos. Puedes filtrar por categoría desde la pantalla principal y el mapa.\n\n' +
      'Los administradores pueden crear, editar y eliminar categorías desde el menú → "Gestionar categorías". Si se elimina una categoría, los eventos que la tenían asignada pasan automáticamente a la categoría "Otros".',
  },
  {
    icon: 'map-marker-path',
    title: 'Rutas recomendadas',
    content:
      'La app puede sugerirte una ruta turística por Sevilla basada en tus intereses y disponibilidad.\n\n' +
      'Desde el menú → "Rutas" puedes ver rutas guardadas o pedir una nueva recomendación. La ruta se muestra en el mapa con los puntos de interés ordenados.\n\n' +
      'Los intereses que indiques en tu perfil influyen en las rutas que se te sugieren.',
  },
  {
    icon: 'account-cog-outline',
    title: 'Perfil e intereses',
    content:
      'Desde el menú puedes editar tu perfil: nombre, foto y lista de intereses.\n\n' +
      'Los intereses se usan para personalizar las rutas recomendadas. Puedes añadir los que quieras (música, gastronomía, historia, etc.).\n\n' +
      'También puedes cambiar tu contraseña desde el perfil. Si quieres eliminar tu cuenta, la opción está al final de la pantalla de edición de perfil.',
  },
  {
    icon: 'account-group-outline',
    title: 'Amigos y seguidores',
    content:
      'Puedes seguir a otros usuarios desde su perfil. Si dos usuarios se siguen mutuamente se consideran "amigos".\n\n' +
      'Desde el menú → "Amigos" puedes ver tus seguidores, a quién sigues, tus amigos y buscar nuevos usuarios por nombre.\n\n' +
      'Puedes enviar mensajes privados a cualquier usuario desde su perfil.',
  },
  {
    icon: 'star-outline',
    title: 'Valorar un evento',
    content:
      'Una vez finalizado un evento al que estabas apuntado, puedes dejar una valoración con puntuación y comentario desde la pantalla de detalle del evento.\n\n' +
      'Las valoraciones son visibles para todos los usuarios. Solo se puede valorar un evento una vez.',
  },
  {
    icon: 'chat-outline',
    title: 'Chat del evento',
    content:
      'Cada evento público tiene un chat en tiempo real visible en su pantalla de detalle.\n\n' +
      'Cualquier usuario puede participar en el chat del evento. Puedes enviar texto e imágenes.',
  },
];

export const HelpScreen: React.FC = () => {
  const { colors, theme } = useTheme();
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggle = (i: number) => setExpanded((prev) => (prev === i ? null : i));

  return (
    <ThemedView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedTextSecondary style={styles.intro}>
          Aquí encontrarás respuestas a las preguntas más frecuentes sobre el funcionamiento de
          Sevillaneando.
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
