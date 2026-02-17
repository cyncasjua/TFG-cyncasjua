import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import dayjs from 'dayjs';
import { RootStackParamList } from '../App';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import { ThemedText, ThemedTextSecondary, ThemedView } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'DirectMessage'>;

type DirectMessage = {
  id: string;
  contenido: string;
  fechaCreacion: string;
  emisor?: { id: string; nombre?: string };
  receptor?: { id: string; nombre?: string };
};

export const DirectMessageScreen: React.FC<Props> = ({ route }) => {
  const { userId, userName } = route.params;
  const { colors } = useTheme();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('DirectMessageScreen: pidiendo historial con', userId);
    socket.emit('dm_history', { withUserId: userId });

    const handleDmHistory = (history: DirectMessage[]) => {
      console.log('dm_history recibido:', history);
      setMessages(history);
    };

    const handleDmMessage = (message: DirectMessage) => {
      console.log('dm_message recibido en DirectMessageScreen:', message);
      setMessages((prev) => [...prev, message]);
    };

    socket.on('dm_history', handleDmHistory);
    socket.on('dm_message', handleDmMessage);

    return () => {
      socket.off('dm_history', handleDmHistory);
      socket.off('dm_message', handleDmMessage);
    };
  }, [socket, isConnected, userId]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedTextSecondary style={{ marginBottom: 8 }}>
        Conversación con {userName}
      </ThemedTextSecondary>
      <ThemedView style={[styles.chatPanel, { backgroundColor: colors.card }]}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
          {messages.map((msg) => {
            const isOwn = msg.emisor?.id === user?.id;
            return (
              <ThemedView
                key={msg.id}
                style={{
                  marginBottom: 6,
                  alignItems: isOwn ? 'flex-end' : 'flex-start',
                }}
              >
                <ThemedView
                  style={{
                    padding: 8,
                    borderRadius: 10,
                    maxWidth: '85%',
                    backgroundColor: isOwn ? '#6c2eb7' : colors.card,
                    borderWidth: isOwn ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  <ThemedTextSecondary style={{ fontSize: 12 }}>
                    {isOwn ? 'Tu' : msg.emisor?.nombre ?? 'Usuario'}
                  </ThemedTextSecondary>
                  <ThemedText style={{ color: isOwn ? '#fff' : colors.text }}>
                    {msg.contenido}
                  </ThemedText>
                  <ThemedTextSecondary style={{ fontSize: 11, marginTop: 4 }}>
                    {dayjs(msg.fechaCreacion).format('HH:mm')}
                  </ThemedTextSecondary>
                </ThemedView>
              </ThemedView>
            );
          })}
        </ScrollView>

        <ThemedView style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
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
              const trimmed = input.trim();
              if (!trimmed || !socket) return;
              socket.emit('dm_message', { toUserId: userId, text: trimmed });
              setInput('');
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
      </ThemedView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  chatPanel: { flex: 1, borderRadius: 16, padding: 12 },
});
