import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getSeguidos, getSeguidores, searchUsers, seguirUsuario } from '../services/users';
import { Avatar, ThemedText, ThemedView } from '../components';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import type { PublicUser } from '../types/user';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'Friends'>;

type Tab = 'seguidores' | 'seguidos' | 'amigos' | 'buscar';

export const FriendsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('seguidores');
  const [seguidores, setSeguidores] = useState<PublicUser[]>([]);
  const [seguidos, setSeguidos] = useState<PublicUser[]>([]);
  const [amigos, setAmigos] = useState<PublicUser[]>([]);
  const [loadingSeguidos, setLoadingSeguidos] = useState(true);
  const [loadingSeguidores, setLoadingSeguidores] = useState(true);
  const [followingBack, setFollowingBack] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);

  const loadSeguidos = useCallback(async () => {
    if (!user?.id) return [] as PublicUser[];
    setLoadingSeguidos(true);
    try {
      const list = await getSeguidos(user.id);
      setSeguidos(list);
      return list;
    } catch {
      setSeguidos([]);
      return [] as PublicUser[];
    } finally {
      setLoadingSeguidos(false);
    }
  }, [user?.id]);

  const loadSeguidores = useCallback(
    async (seguidosList?: PublicUser[]) => {
      if (!user?.id) return;
      setLoadingSeguidores(true);
      try {
        const [followers, followed] = await Promise.all([
          getSeguidores(user.id),
          seguidosList ? Promise.resolve(seguidosList) : getSeguidos(user.id),
        ]);
        const followedIds = new Set(followed.map((s) => s.id));
        setSeguidores(followers);
        setAmigos(followers.filter((f) => followedIds.has(f.id)));
      } catch {
        setSeguidores([]);
        setAmigos([]);
      } finally {
        setLoadingSeguidores(false);
      }
    },
    [user?.id]
  );

  useFocusEffect(
    useCallback(() => {
      loadSeguidos().then((list) => loadSeguidores(list));
    }, [loadSeguidos, loadSeguidores])
  );

  const isFollowedByCurrentUser = (id: string) => seguidos.some((u) => u.id === id);

  const handleFollowBack = async (targetId: string) => {
    setFollowingBack((prev) => new Set(prev).add(targetId));
    try {
      await seguirUsuario(targetId);
      setSeguidos((prev) => {
        const alreadyIn = prev.some((u) => u.id === targetId);
        if (alreadyIn) return prev;
        const followed = seguidores.find((u) => u.id === targetId);
        return followed ? [...prev, followed] : prev;
      });
      setAmigos((prev) => {
        const alreadyIn = prev.some((u) => u.id === targetId);
        if (alreadyIn) return prev;
        const followed = seguidores.find((u) => u.id === targetId);
        return followed ? [...prev, followed] : prev;
      });
    } finally {
      setFollowingBack((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  };

  const handleSearch = useCallback(
    async (q: string) => {
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
    },
    [user?.id]
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

  const renderFollower = ({ item }: { item: PublicUser }) => {
    const loading = followingBack.has(item.id);
    const canFollowBack = !isFollowedByCurrentUser(item.id);

    if (!canFollowBack) return renderUser({ item });

    return (
      <View style={[styles.userRow, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={styles.userRowInner}
          onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
        >
          <Avatar photoUrl={item.fotoPerfil} size={48} />
          <View style={styles.userInfo}>
            <ThemedText style={styles.userName}>{item.nombre}</ThemedText>
            <ThemedText style={[styles.subText, { color: colors.text + '88' }]}>
              Te sigue
            </ThemedText>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.followBackBtn, { backgroundColor: colors.primary }]}
          onPress={() => handleFollowBack(item.id)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ThemedText style={styles.followBackText}>Seguir</ThemedText>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedView style={styles.header}>
        <View style={styles.tabRow}>
          <View style={[styles.tabs, { backgroundColor: colors.card, flex: 1 }]}>
            {(['seguidores', 'seguidos', 'amigos'] as Tab[]).map((item) => {
              const iconName =
                item === 'seguidores'
                  ? 'account-arrow-left-outline'
                  : item === 'seguidos'
                  ? 'account-arrow-right-outline'
                  : 'account-heart-outline';
              const label =
                item === 'seguidores' ? 'Seguidores' : item === 'seguidos' ? 'Seguidos' : 'Amigos';
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.tab, tab === item && { backgroundColor: colors.primary }]}
                  onPress={() => setTab(item)}
                >
                  <Icon
                    name={iconName}
                    size={16}
                    color={tab === item ? '#fff' : colors.text + '99'}
                  />
                  <ThemedText style={[styles.tabText, tab === item && { color: '#fff' }]}>
                    {label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[
              styles.searchIconBtn,
              {
                backgroundColor: tab === 'buscar' ? colors.primary : colors.card,
              },
            ]}
            onPress={() => setTab('buscar')}
          >
            <Icon name="magnify" size={22} color={tab === 'buscar' ? '#fff' : colors.text + '99'} />
          </TouchableOpacity>
        </View>
      </ThemedView>

      {tab === 'seguidores' ? (
        loadingSeguidores ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <FlatList
            data={seguidores}
            keyExtractor={(item) => item.id}
            renderItem={renderFollower}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="account-arrow-left-outline" size={44} color={colors.text + '33'} />
                <ThemedText style={styles.empty}>Aún no tienes seguidores.</ThemedText>
              </View>
            }
          />
        )
      ) : tab === 'seguidos' ? (
        loadingSeguidos ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <FlatList
            data={seguidos}
            keyExtractor={(item) => item.id}
            renderItem={renderUser}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="account-arrow-right-outline" size={44} color={colors.text + '33'} />
                <ThemedText style={styles.empty}>Aún no sigues a nadie.</ThemedText>
              </View>
            }
          />
        )
      ) : tab === 'amigos' ? (
        loadingSeguidores ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <FlatList
            data={amigos}
            keyExtractor={(item) => item.id}
            renderItem={renderUser}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="account-heart-outline" size={44} color={colors.text + '33'} />
                <ThemedText style={styles.empty}>
                  Aún no tienes amigos. ¡Sigue a alguien que te siga de vuelta!
                </ThemedText>
              </View>
            }
          />
        )
      ) : (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.card, borderColor: colors.primary },
              ]}
            >
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
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                searchQuery.length >= 2 && !searching ? (
                  <ThemedText style={styles.empty}>No se encontraron usuarios.</ThemedText>
                ) : null
              }
            />
          </View>
        </TouchableWithoutFeedback>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, paddingBottom: 0 },
  tabRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  tabs: { flexDirection: 'row', borderRadius: 999, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  tabText: { fontWeight: '600', fontSize: 12 },
  searchIconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, padding: 12, gap: 12 },
  userRowInner: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  userInfo: { flex: 1 },
  userName: { fontWeight: '600', fontSize: 15 },
  subText: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', opacity: 0.5, fontSize: 14, maxWidth: 240 },
  emptyContainer: { alignItems: 'center', marginTop: 48, gap: 10 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    borderRadius: 30,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 2 },
  followBackBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    minWidth: 64,
    alignItems: 'center',
  },
  followBackText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
