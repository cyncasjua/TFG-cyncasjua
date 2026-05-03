import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

dayjs.extend(relativeTime);
import { RootStackParamList } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import { reportWarning } from '../utils/telemetry';
import { Avatar, ThemedText, ThemedTextSecondary, ThemedView } from '../components';
import { api } from '../services';

type Props = NativeStackScreenProps<RootStackParamList, 'Messages'>;

type Conversation = {
  userId: string;
  userName: string;
  userPhoto?: string | null;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
};

export const MessagesScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userPhotoById, setUserPhotoById] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userIdsToFetch = new Set<string>(
      conversations.filter((c) => c.userId).map((c) => c.userId)
    );

    if (userIdsToFetch.size === 0) return;

    userIdsToFetch.forEach((userId) => {
      void api
        .get(`/users/${userId}`)
        .then((res) => {
          const fotoPerfil = res?.data?.fotoPerfil ?? null;
          setUserPhotoById((prev) => ({ ...prev, [userId]: fotoPerfil }));
        })
        .catch((err) => {
          console.error(`[MessagesScreen fallback] Error cargando foto de ${userId}:`, err);
          setUserPhotoById((prev) => ({ ...prev, [userId]: null }));
        });
    });
  }, [conversations]);

  useFocusEffect(
    React.useCallback(() => {
      if (!socket || !isConnected) {
        return;
      }

      const timeout = setTimeout(() => {
        if (loading) {
          setConversations([]);
          setLoading(false);
        }
      }, 5000);

      socket.emit('get_conversations');

      const handleConversations = (data: Conversation[]) => {
        clearTimeout(timeout);
        setConversations(data);
        setLoading(false);
      };

      const handleDmMessage = (message: any) => {
        clearTimeout(timeout);
        setLoading(false);
        setConversations((prev) => {
          const otherUserId =
            message.emisor?.id === user?.id ? message.receptor?.id : message.emisor?.id;
          const otherUserName =
            message.emisor?.id === user?.id ? message.receptor?.nombre : message.emisor?.nombre;
          const otherUserPhoto =
            message.emisor?.id === user?.id
              ? message.receptor?.fotoPerfil
              : message.emisor?.fotoPerfil;

          if (!otherUserId || !otherUserName) {
            reportWarning('messages.dm-message', 'Datos incompletos en dm_message', undefined, {
              otherUserId,
              otherUserName,
            });
            return prev;
          }

          const conversationIndex = prev.findIndex((c) => c.userId === otherUserId);

          if (conversationIndex !== -1) {
            const updated = [...prev];
            updated[conversationIndex] = {
              ...updated[conversationIndex],
              lastMessage: message.contenido,
              lastMessageTime: message.fechaCreacion,
            };
            const [conversation] = updated.splice(conversationIndex, 1);
            return [conversation, ...updated];
          } else {
            const newConversation: Conversation = {
              userId: otherUserId,
              userName: otherUserName,
              userPhoto: otherUserPhoto,
              lastMessage: message.contenido,
              lastMessageTime: message.fechaCreacion,
            };
            return [newConversation, ...prev];
          }
        });
      };

      const handleRefreshConversations = () => {
        socket.emit('get_conversations');
      };

      socket.on('conversations', handleConversations);
      socket.on('dm_message', handleDmMessage);
      socket.on('refresh_conversations', handleRefreshConversations);

      return () => {
        clearTimeout(timeout);
        socket.off('conversations', handleConversations);
        socket.off('dm_message', handleDmMessage);
        socket.off('refresh_conversations', handleRefreshConversations);
      };
    }, [socket, isConnected, user, loading])
  );

  const handleOpenConversation = (userId: string, userName: string) => {
    navigation.navigate('DirectMessage', { userId, userName });
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const unreadCount = item.unreadCount ?? 0;

    return (
      <TouchableOpacity
        onPress={() => handleOpenConversation(item.userId, item.userName)}
        activeOpacity={0.7}
      >
        <ThemedView
          style={[
            styles.conversationCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <Avatar
              photoUrl={item.userPhoto ?? userPhotoById[item.userId]}
              size={48}
              style={styles.avatar}
            />

            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontWeight: '600' }}>{item.userName}</ThemedText>
              {item.lastMessage && (
                <ThemedTextSecondary style={{ marginTop: 4, fontSize: 12 }} numberOfLines={1}>
                  {item.lastMessage}
                </ThemedTextSecondary>
              )}
              {item.lastMessageTime && (
                <ThemedTextSecondary style={{ marginTop: 2, fontSize: 10 }}>
                  {dayjs(item.lastMessageTime).fromNow()}
                </ThemedTextSecondary>
              )}
            </View>

            {unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: '#6c2eb7' }]}>
                <ThemedText style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </ThemedText>
              </View>
            )}
          </View>

          <MaterialIcons name="chevron-right" size={24} color={colors.text} />
        </ThemedView>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ThemedText>Cargando mensajes...</ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="mail-outline" size={64} color={colors.text + '50'} />
          <ThemedText style={{ marginTop: 16, textAlign: 'center' }}>
            No hay conversaciones
          </ThemedText>
          <ThemedTextSecondary style={{ marginTop: 8, textAlign: 'center', fontSize: 12 }}>
            Inicia una conversación privada desde un evento o perfil de usuario
          </ThemedTextSecondary>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.list}
          scrollEnabled
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 12, gap: 8 },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    minHeight: 72,
  },
  avatar: {},
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
});
