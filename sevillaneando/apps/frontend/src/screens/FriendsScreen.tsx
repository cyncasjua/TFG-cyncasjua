import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getSeguidos, searchUsers } from '../services/users';
import { Avatar, ThemedText, ThemedTitle, ThemedView } from '../components';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import type { PublicUser } from '../types/user';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'Friends'>;

type Tab = 'seguidos' | 'buscar';

export const FriendsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('seguidos');
  const [seguidos, setSeguidos] = useState<PublicUser[]>([]);
  const [loadingSeguidos, setLoadingSeguidos] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setLoadingSeguidos(true);
    getSeguidos(user.id)
      .then(setSeguidos)
      .catch(() => setSeguidos([]))
      .finally(() => setLoadingSeguidos(false));
  }, [user?.id]);

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchUsers(q.trim());
      setSearchResults(results.filter((u) => u.id !== user?.id));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [user?.id]);

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedView style={styles.header}>
        <ThemedTitle>Amigos</ThemedTitle>
        <View style={[styles.tabs, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={[styles.tab, tab === 'seguidos' && { backgroundColor: colors.primary }]}
            onPress={() => setTab('seguidos')}
          >
            <ThemedText style={[styles.tabText, tab === 'seguidos' && { color: '#fff' }]}>
              Siguiendo
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'buscar' && { backgroundColor: colors.primary }]}
            onPress={() => setTab('buscar')}
          >
            <ThemedText style={[styles.tabText, tab === 'buscar' && { color: '#fff' }]}>
              Buscar
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>

      {tab === 'seguidos' ? (
        loadingSeguidos ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <FlatList
            data={seguidos}
            keyExtractor={(item) => item.id}
            renderItem={renderUser}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <ThemedText style={styles.empty}>Aún no sigues a nadie.</ThemedText>
            }
          />
        )
      ) : (
        <View style={{ flex: 1 }}>
          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <Icon name="magnify" size={20} color={colors.text + '88'} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Buscar usuarios por nombre..."
              placeholderTextColor={colors.text + '66'}
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searching && <ActivityIndicator size="small" color={colors.primary} />}
          </View>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={renderUser}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              searchQuery.length >= 2 && !searching ? (
                <ThemedText style={styles.empty}>No se encontraron usuarios.</ThemedText>
              ) : null
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingBottom: 0, gap: 12 },
  tabs: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabText: { fontWeight: '600', fontSize: 14 },
  list: { padding: 16, gap: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 10, gap: 12 },
  userInfo: { flex: 1 },
  userName: { fontWeight: '600', fontSize: 15 },
  empty: { textAlign: 'center', opacity: 0.5, marginTop: 32 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 2 },
});
