import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { RootStackParamList } from '../App';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import { useNotificaciones } from '../context/NotificacionesContext';
import { getFullImageUrl } from '../utils/imageUrl';
import { formatSevillaTime } from '../utils/sevillaTime';
import { reportError } from '../utils/telemetry';
import { Avatar, ThemedText, ThemedTextSecondary, ThemedView } from '../components';
import { api } from '../services/api';

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
  const { refresh: refreshNotificaciones } = useNotificaciones();
  const { socket, isConnected, sendMessage } = useSocket();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [userPhotoById, setUserPhotoById] = useState<Record<string, string | null>>({});
  const [input, setInput] = useState('');
  const [chatError, setChatError] = useState('');
  const [pendingImageLocalUri, setPendingImageLocalUri] = useState<string | null>(null);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const chatScrollRef = useRef<ScrollView>(null);

  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const lastScaleRef = useRef(1);
  const imageScale = Animated.multiply(baseScale, pinchScale);

  const onPinchEvent = Animated.event([{ nativeEvent: { scale: pinchScale } }], {
    useNativeDriver: true,
  });

  const marcarNotificacionesPrivadasLeidas = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get(`/notificaciones/usuario/${user.id}`);
      const privadasNoLeidas = res.data.filter(
        (n: any) =>
          !n.leida &&
          n.mensaje?.toLowerCase().includes(userName.toLowerCase())
      );
      await Promise.all(
        privadasNoLeidas.map((n: any) =>
          api.patch(`/notificaciones/${n.id}/leida`)
        )
      );
      await refreshNotificaciones();
    } catch (e) {
      // Silenciar error
    }
  }, [user, userName, refreshNotificaciones]);

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

  const scrollChatToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
      setIsKeyboardVisible(true);
      scrollChatToBottom();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollChatToBottom]);

  useEffect(() => {
    scrollChatToBottom();
  }, [messages, scrollChatToBottom]);

  useEffect(() => {
    const userIdsToFetch = new Set<string>();

    messages.forEach((m) => {
      // SIEMPRE intenta traer fotos, aunque vengan incompletas o null
      if (m.emisor?.id) {
        userIdsToFetch.add(m.emisor.id);
      }
      if (m.receptor?.id) {
        userIdsToFetch.add(m.receptor.id);
      }
    });

    if (userIdsToFetch.size === 0) return;


    userIdsToFetch.forEach((uid) => {
      void api
        .get(`/users/${uid}`)
        .then((res) => {
          const fotoPerfil = res?.data?.fotoPerfil ?? null;
          setUserPhotoById((prev) => ({ ...prev, [uid]: fotoPerfil }));
        })
        .catch((err) => {
          setUserPhotoById((prev) => ({ ...prev, [uid]: null }));
        });
    });
  }, [messages]);

  const handleSend = () => {
    const trimmedText = input.trim();
    if (!trimmedText && !pendingImageUrl) return;

    sendMessage('dm_message', {
      toUserId: userId,
      text: trimmedText,
      imageUrl: pendingImageUrl ?? undefined,
    });

    setInput('');
    setPendingImageLocalUri(null);
    setPendingImageUrl(null);
    Keyboard.dismiss();
  };

  const uploadChatImage = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!token) {
      setChatError('Necesitas iniciar sesion para subir imagenes');
      return;
    }
    if (!asset?.uri) return;

    try {
      setChatError('');
      setIsUploadingImage(true);

      const processed = await manipulateAsync(
        asset.uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.75, format: SaveFormat.JPEG }
      ).catch(() => null);

      const uploadUri = processed?.uri;
      if (!uploadUri) {
        setChatError('No se pudo preparar la imagen');
        setPendingImageLocalUri(null);
        setPendingImageUrl(null);
        return;
      }

      const name = `dm-${Date.now()}.jpg`;
      const mimeType = 'image/jpeg';

      const formData = new FormData();
      formData.append('file', { uri: uploadUri, name, type: mimeType } as any);

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
      reportError('dm.upload-image', 'Error al subir imagen de chat directo', error);
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
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      await uploadChatImage(asset);
    } catch (error) {
      reportError('dm.pick-image', 'Error al seleccionar imagen de galería', error);
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
      reportError('dm.take-photo', 'Error al tomar foto en chat directo', error);
      setChatError('Error al tomar la foto');
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    Alert.alert(
      'Borrar mensaje',
      '¿Estás seguro de que quieres borrar este mensaje?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          onPress: () => {
            sendMessage('delete_dm', { messageId });
          },
          style: 'destructive',
        },
      ]
    );
  };

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit('dm_history', { withUserId: userId });

    socket.emit('mark_as_read', { senderId: userId });

    marcarNotificacionesPrivadasLeidas();

    const handleDmHistory = (history: DirectMessage[]) => {
      setMessages(history);
    };

    const handleDmMessage = (message: DirectMessage) => {
      setMessages((prev) => [...prev, message]);

      if (message.emisor?.id === userId) {
        socket.emit('mark_as_read', { senderId: userId });
      }
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
  }, [socket, isConnected, userId, marcarNotificacionesPrivadasLeidas]);

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

        <ScrollView
          ref={chatScrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 12 }}
          onContentSizeChange={scrollChatToBottom}
          onLayout={scrollChatToBottom}
        >
          {messages.map((item) => {
            const isOwn = item.emisor?.id === user?.id;
            const isLight = colors.background === '#FFFFFF' || colors.background === '#fff' || colors.background === 'white';
            const nameColor = isOwn && isLight ? '#e0e0e0' : '#9bbcff';
            const messageColor = isOwn && isLight ? '#fff' : '#e6e8ef';

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
                      <Avatar photoUrl={item.emisor?.fotoPerfil ?? userPhotoById[item.emisor?.id ?? '']} size={24} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onLongPress={() => isOwn && handleDeleteMessage(item.id)}
                    activeOpacity={0.9}
                    style={{
                      padding: 8,
                      borderRadius: 16,
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
                        onPress={() => setPreviewImageUrl(getFullImageUrl(item.imageUrl) ?? null)}
                      >
                        {(() => {
                          const imageUri = getFullImageUrl(item.imageUrl);
                          if (!imageUri) return null;
                          return (
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.chatMessageImage}
                          resizeMode="cover"
                        />
                          );
                        })()}
                      </TouchableOpacity>
                    )}
                    <ThemedTextSecondary
                      style={{
                        fontSize: 11,
                        marginTop: 4,
                        color: colors.text + '99',
                      }}
                    >
                      {formatSevillaTime(item.fechaCreacion)}
                    </ThemedTextSecondary>
                  </TouchableOpacity>
                </ThemedView>
              </ThemedView>
            );
          })}
        </ScrollView>

        {!!pendingImageUrl && (
          <ThemedView style={styles.chatAttachment}>
            <MaterialIcons name="image" size={18} color={colors.text} />
            <ThemedTextSecondary style={{ marginLeft: 8, color: colors.text + '99' }}>
              Imagen lista para enviar
            </ThemedTextSecondary>
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
        )}

        <ThemedView
          style={[
            styles.chatComposer,
            { marginBottom: isKeyboardVisible ? Math.max(keyboardHeight - 10, 0) : 0 },
          ]}
        >
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
              borderRadius: 16,
              padding: 10,
              color: colors.text,
            }}
            placeholderTextColor={colors.text + '99'}
          />
          <TouchableOpacity
            onPress={handleSend}
            style={{
              marginLeft: 8,
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: '#6c2eb7',
              borderRadius: 16,
            }}
          >
            <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>Enviar</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </ThemedView>

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
          {!!getFullImageUrl(previewImageUrl) && (
            <PinchGestureHandler
              onGestureEvent={onPinchEvent}
              onHandlerStateChange={handlePinchStateChange}
            >
              <Animated.Image
                source={{
                  uri: getFullImageUrl(previewImageUrl)!,
                }}
                style={[styles.imagePreviewImage, { transform: [{ scale: imageScale }] }]}
                resizeMode="contain"
              />
            </PinchGestureHandler>
          )}
        </View>
      </Modal>
    </SafeAreaView>
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
    borderRadius: 16,
  },
  chatAttachment: {
    position: 'relative',
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  chatAttachmentImage: {
    width: '100%',
    height: 100,
    borderRadius: 16,
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
    borderRadius: 16,
    backgroundColor: 'rgba(108, 46, 183, 0.1)',
  },
  chatComposer: {
    flexDirection: 'row',
    marginTop: 8,
    alignItems: 'center',
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



