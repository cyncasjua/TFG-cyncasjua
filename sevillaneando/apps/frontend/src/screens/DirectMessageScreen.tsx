import React, { useEffect, useState, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Modal,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../App';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import { getFullImageUrl } from '../utils/imageUrl';
import { ThemedText, ThemedTextSecondary, ThemedView } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'DirectMessage'>;

type DirectMessage = {
  id: string;
  contenido: string;
  fechaCreacion: string;
  imageUrl?: string | null;
  emisor?: { id: string; nombre?: string; fotoPerfil?: string };
  receptor?: { id: string; nombre?: string; fotoPerfil?: string };
};

export const DirectMessageScreen: React.FC<Props> = ({ route, navigation }) => {
  const { userId, userName } = route.params;
  const { colors } = useTheme();
  const { user, token } = useAuth();
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatError, setChatError] = useState('');
  const [pendingImageLocalUri, setPendingImageLocalUri] = useState<string | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const lastScaleRef = useRef(1);
  const imageScale = Animated.multiply(baseScale, pinchScale);

  const onPinchEvent = Animated.event([{ nativeEvent: { scale: pinchScale } }], {
    useNativeDriver: true,
  });

  const handlePinchStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.END) {
      lastScaleRef.current *= nativeEvent.scale;
      baseScale.setValue(lastScaleRef.current);
      pinchScale.setValue(1);
    }
  };

  const closePreview = () => {
    setPreviewImageUrl(null);
    baseScale.setValue(1);
    pinchScale.setValue(1);
    lastScaleRef.current = 1;
  };

  const uploadChatImage = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!token) {
      setChatError('Necesitas iniciar sesion para subir imagenes');
      return;
    }
    if (!asset?.uri) return;

    try {
      setChatError('');
      setPendingImageLocalUri(asset.uri);
      setIsUploadingImage(true);

      const uriParts = asset.uri.split('.');
      const ext = uriParts.length > 1 ? uriParts[uriParts.length - 1] : 'jpg';
      const mimeType = asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const name = asset.fileName ?? `dm-${Date.now()}.${ext}`;

      const formData = new FormData();
      formData.append('file', { uri: asset.uri, name, type: mimeType } as any);

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/chat/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        setChatError('No se pudo subir la imagen');
        setPendingImageLocalUri(null);
        setPendingImageUrl(null);
        return;
      }

      const data = await response.json();
      if (!data?.imageUrl) {
        setChatError('Respuesta de imagen invalida');
        setPendingImageLocalUri(null);
        setPendingImageUrl(null);
        return;
      }

      setPendingImageUrl(data.imageUrl);
    } catch (error) {
      console.error(error);
      setChatError('Error al subir la imagen');
      setPendingImageLocalUri(null);
      setPendingImageUrl(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handlePickImage = async () => {
    if (!token) {
      setChatError('Necesitas iniciar sesion para subir imagenes');
      return;
    }

    try {
      setChatError('');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        setChatError('Permiso requerido para acceder a fotos');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      await uploadChatImage(asset);
    } catch (error) {
      console.error(error);
      setChatError('Error al seleccionar la imagen');
    }
  };

  const handleTakePhoto = async () => {
    if (!token) {
      setChatError('Necesitas iniciar sesion para subir imagenes');
      return;
    }

    try {
      setChatError('');
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        setChatError('Permiso requerido para usar la camara');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      await uploadChatImage(asset);
    } catch (error) {
      console.error(error);
      setChatError('Error al tomar la foto');
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    Alert.alert(
      'Borrar mensaje',
      '¿Estás seguro de que quieres borrar este mensaje?',
      [
        { text: 'Cancelar', onPress: () => { }, style: 'cancel' },
        {
          text: 'Borrar',
          onPress: () => {
            if (socket) {
              socket.emit('delete_dm', { messageId });
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit('dm_history', { withUserId: userId });

    const handleDmHistory = (history: DirectMessage[]) => {
      setMessages(history);
    };

    const handleDmMessage = (message: DirectMessage) => {
      setMessages((prev) => [...prev, message]);
    };

    const handleDeleteDmSuccess = (messageId: string) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    };

    socket.on('dm_history', handleDmHistory);
    socket.on('dm_message', handleDmMessage);
    socket.on('delete_dm_success', handleDeleteDmSuccess);

    return () => {
      socket.off('dm_history', handleDmHistory);
      socket.off('dm_message', handleDmMessage);
      socket.off('delete_dm_success', handleDeleteDmSuccess);
    };
  }, [socket, isConnected, userId]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedView style={[styles.chatPanel, { backgroundColor: colors.card }]}>
        <ThemedView style={styles.chatHeader}>
          <ThemedText style={{ fontWeight: 'bold', fontSize: 16 }}>{userName}</ThemedText>
        </ThemedView>

        {!!chatError && (
          <ThemedTextSecondary style={{ marginBottom: 6, color: '#c0392b' }}>
            {chatError}
          </ThemedTextSecondary>
        )}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
          {messages.map((item) => {
            const isOwn = item.emisor?.id === user?.id;
            const nameColor = '#9bbcff';
            const messageColor = '#e6e8ef';

            return (
              <ThemedView
                key={item.id}
                style={{
                  marginBottom: 6,
                  alignItems: isOwn ? 'flex-end' : 'flex-start',
                }}
              >
                <ThemedView
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 6,
                    maxWidth: '85%',
                  }}
                >
                  {!isOwn && item.emisor?.id && (
                    <TouchableOpacity
                      onPress={() => {
                        if (item.emisor?.id) {
                          navigation.navigate('UserProfile', {
                            userId: item.emisor.id,
                          });
                        }
                      }}
                      style={{ marginTop: 2 }}
                    >
                      {item.emisor?.fotoPerfil ? (
                        <Image
                          source={{
                            uri:
                              getFullImageUrl(item.emisor.fotoPerfil) ||
                              item.emisor.fotoPerfil,
                          }}
                          style={{ width: 24, height: 24, borderRadius: 12 }}
                        />
                      ) : (
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: '#d0d0d0',
                          }}
                        />
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onLongPress={() => isOwn && handleDeleteMessage(item.id)}
                    activeOpacity={0.9}
                    style={{
                      padding: 8,
                      borderRadius: 10,
                      backgroundColor: isOwn ? '#6c2eb7' : colors.card,
                      flex: 1,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        if (item.emisor?.id && !isOwn) {
                          navigation.navigate('UserProfile', {
                            userId: item.emisor.id,
                          });
                        }
                      }}
                      disabled={!item.emisor?.id || isOwn}
                    >
                      <ThemedTextSecondary
                        style={{ fontSize: 12, color: nameColor }}
                      >
                        {isOwn ? 'Tu' : item.emisor?.nombre ?? 'Usuario'}
                      </ThemedTextSecondary>
                    </TouchableOpacity>
                    {!!item.contenido?.trim() && (
                      <ThemedText style={{ color: messageColor }}>
                        {item.contenido}
                      </ThemedText>
                    )}
                    {!!item.imageUrl && (
                      <TouchableOpacity
                        onPress={() => setPreviewImageUrl(item.imageUrl ?? null)}
                      >
                        <Image
                          source={{ uri: getFullImageUrl(item.imageUrl) || item.imageUrl }}
                          style={styles.chatMessageImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    )}
                    <ThemedTextSecondary
                      style={{
                        fontSize: 11,
                        marginTop: 4,
                        color: colors.text + '99',
                      }}
                    >
                      {dayjs(item.fechaCreacion).format('HH:mm')}
                    </ThemedTextSecondary>
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            );
          })}
        </ScrollView>

        {
          !!pendingImageLocalUri && (
            <ThemedView style={styles.chatAttachment}>
              <Image
                source={{ uri: pendingImageLocalUri }}
                style={styles.chatAttachmentImage}
              />
              <TouchableOpacity
                onPress={() => {
                  setPendingImageLocalUri(null);
                  setPendingImageUrl(null);
                }}
                style={styles.chatAttachmentRemove}
              >
                <MaterialIcons name="close" size={16} color={colors.text} />
              </TouchableOpacity>
            </ThemedView>
          )
        }

        <ThemedView style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={handlePickImage}
            disabled={isUploadingImage}
            style={styles.chatImageButton}
          >
            <MaterialIcons name="image" size={20} color="#6c2eb7" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleTakePhoto}
            disabled={isUploadingImage}
            style={styles.chatImageButton}
          >
            <MaterialIcons name="photo-camera" size={20} color="#6c2eb7" />
          </TouchableOpacity>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Escribe un mensaje..."
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              padding: 10,
              color: colors.text,
            }}
            placeholderTextColor={colors.text + '99'}
          />
          <TouchableOpacity
            onPress={() => {
              const trimmedText = input.trim();
              if ((!trimmedText && !pendingImageUrl) || !socket) return;
              socket.emit('dm_message', {
                toUserId: userId,
                text: trimmedText,
                imageUrl: pendingImageUrl ?? undefined,
              });
              setInput('');
              setPendingImageLocalUri(null);
              setPendingImageUrl(null);
            }}
            style={{
              marginLeft: 8,
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: '#6c2eb7',
              borderRadius: 10,
            }}
          >
            <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Enviar</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView >

      <Modal
        visible={!!previewImageUrl}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.imagePreviewOverlay}>
          <TouchableOpacity
            style={styles.imagePreviewBackdrop}
            onPress={closePreview}
            activeOpacity={1}
          />
          <TouchableOpacity style={styles.imagePreviewClose} onPress={closePreview}>
            <MaterialIcons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          {!!previewImageUrl && (
            <PinchGestureHandler
              onGestureEvent={onPinchEvent}
              onHandlerStateChange={handlePinchStateChange}
            >
              <Animated.Image
                source={{
                  uri: getFullImageUrl(previewImageUrl) || previewImageUrl,
                }}
                style={[styles.imagePreviewImage, { transform: [{ scale: imageScale }] }]}
                resizeMode="contain"
              />
            </PinchGestureHandler>
          )}
        </View>
      </Modal>
    </SafeAreaView >
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  chatPanel: { flex: 1, borderRadius: 16, padding: 12 },
  chatHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  chatMessageImage: {
    marginTop: 6,
    width: 200,
    height: 120,
    borderRadius: 10,
  },
  chatAttachment: {
    position: 'relative',
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  chatAttachmentImage: {
    width: '100%',
    height: 100,
    borderRadius: 10,
  },
  chatAttachmentRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    padding: 6,
  },
  chatImageButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(108, 46, 183, 0.1)',
  },
  imagePreviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  imagePreviewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
  },
  imagePreviewImage: {
    width: '90%',
    height: '90%',
  },
});
