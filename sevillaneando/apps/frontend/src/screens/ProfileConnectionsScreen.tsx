import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getSeguidores, getSeguidos } from '../services/users';
import { Avatar, ThemedText } from '../components';
import { useTheme } from '../hooks/useTheme';
import type { PublicUser } from '../types/user';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileConnections'>;

export const ProfileConnectionsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { userId, type } = route.params;
  const { colors } = useTheme();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);

  const title = type === 'seguidores' ? 'Seguidores' : 'Seguidos';

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const list = type === 'seguidores' ? await getSeguidores(userId) : await getSeguidos(userId);
      setUsers(list);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [type, userId]);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title });
      loadUsers();
    }, [loadUsers, navigation, title])
  );

  const renderUser = ({ item }: { item: PublicUser }) => (
    <TouchableOpacity
      style={[styles.userRow, { backgroundColor: colors.card }]}
      onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
    >
      <Avatar photoUrl={item.fotoPerfil} size={48} />
      <View style={styles.userInfo}>
        <ThemedText style={styles.userName}>{item.nombre}</ThemedText>
      </View>
      <Icon name="chevron-right" size={20} color={colors.text + '66'} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ThemedText style={styles.empty}>
              {type === 'seguidores' ? 'Aún no hay seguidores.' : 'Aún no sigue a nadie.'}
            </ThemedText>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, padding: 12, gap: 12 },
  userInfo: { flex: 1 },
  userName: { fontWeight: '600', fontSize: 15 },
  empty: { textAlign: 'center', opacity: 0.5, marginTop: 32 },
});
