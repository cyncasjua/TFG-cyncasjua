import React from 'react';
import { Modal, View, Share, Clipboard, Alert, StyleSheet } from 'react-native';
import { ThemedView, ThemedText, ThemedButton } from '../components';
import { useTheme } from '../hooks/useTheme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface PrivateEventLinkModalProps {
  visible: boolean;
  linkAcceso: string;
  eventTitle: string;
  onClose: () => void;
}

export const PrivateEventLinkModal: React.FC<PrivateEventLinkModalProps> = ({
  visible,
  linkAcceso,
  eventTitle,
  onClose,
}) => {
  const { colors } = useTheme();
  const shareBaseUrl = (process.env.EXPO_PUBLIC_SHARE_BASE_URL || '').replace(/\/$/, '');
  const appDeepLink = `sevillaneando://acceso/${linkAcceso}`;
  const webPrivateLink = shareBaseUrl ? `${shareBaseUrl}/acceso/${linkAcceso}` : '';
  const fullLink = webPrivateLink || appDeepLink;

  const handleCopyLink = () => {
    Clipboard.setString(fullLink);
    Alert.alert('Enlace copiado', 'El enlace de acceso privado se ha copiado al portapapeles.');
  };

  const handleShareLink = async () => {
    const shareMessage = [
      `Te invito a un evento privado en Sevillaneando: ${eventTitle}`,
      '',
      `Acceso directo: ${fullLink}`,
      webPrivateLink ? `Abrir en la app: ${appDeepLink}` : null,
      'Nos vemos dentro.',
    ]
      .filter((line): line is string => !!line)
      .join('\n');

    try {
      await Share.share({
        message: shareMessage,
        title: eventTitle,
      });
    } catch (error) {
      Alert.alert('Error al compartir', 'No se pudo compartir el enlace de acceso privado.');
    }
  };

  return (
    <Modal visible= {visible} transparent animationType="fade">
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
        <ThemedView style= {[styles.modal, {backgroundColor: colors.card}]}>
          <Icon
            name="lock-outline"
            size={48}
            color= {colors.primary}
            style={{ alignSelf: 'center', marginBottom: 16 }}
          />
          <ThemedText style= {styles.title}>Evento Privado Creado</ThemedText>
          <ThemedText style= {styles.subtitle}>Comparte el siguiente enlace para que otros puedan unirse al evento:</ThemedText>

          <View style= {[styles.linkContainer, {borderColor: colors.primary}]}>
            <ThemedText style= {styles.linkText}>{fullLink}</ThemedText>
          </View>

          <View style= {styles.buttonContainer}>
            <ThemedButton
              style={{flex:1, marginRight: 8}}
              onPress={handleCopyLink}
              title="Copiar"
            />
            <ThemedButton
              style={{flex:1, marginLeft: 8}}
              onPress={handleShareLink}
              title="Compartir"
            />
          </View>

          <ThemedButton
            style={{marginTop: 16}}
            onPress={onClose}
            title="Continuar"
          />
        </ThemedView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    borderRadius: 18,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.7,
  },
  linkContainer: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
});
