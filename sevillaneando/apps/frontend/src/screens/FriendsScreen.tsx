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
import { Avatar, ThemedText, ThemedTitle, ThemedView } from '../components';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import type { PublicUser } from '../types/user';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'Friends'>;

type Tab = 'seguidos' | 'seguidores' | 'buscar';

export const FriendsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('seguidos');
  const [seguidos, setSeguidos] = useState<PublicUser[]>([]);
  const [seguidoresNoSeguidos, setSeguidoresNoSeguidos] = useState<PublicUser[]>([]);
  const [loadingSeguidos, setLoadingSeguidos] = useState(true);
  const [loadingSeguidores, setLoadingSeguidores] = useState(true);
  const [followingBack, setFollowingBack] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);

  const loadSeguidos = useCallback(async () => {
    if (!user?.id) return;
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
        const [allFollowers, currentSeguidos] = await Promise.all([
          getSeguidores(user.id),
          seguidosList ? Promise.resolve(seguidosList) : getSeguidos(user.id),
        ]);
        const seguidosIds = new Set(currentSeguidos.map((s) => s.id));
        setSeguidoresNoSeguidos(allFollowers.filter((f) => !seguidosIds.has(f.id)));
      } catch {
        setSeguidoresNoSeguidos([]);
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

  const handleFollowBack = async (targetId: string) => {
    setFollowingBack((prev) => new Set(prev).add(targetId));
    try {
      await seguirUsuario(targetId);
      setSeguidoresNoSeguidos((prev) => prev.filter((u) => u.id !== targetId));
      setSeguidos((prev) => {
        const alreadyIn = prev.some((u) => u.id === targetId);
        if (alreadyIn) return prev;
        const followed = seguidoresNoSeguidos.find((u) => u.id === targetId);
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

  const renderFollowerBack = ({ item }: { item: PublicUser }) => {
    const loading = followingBack.has(item.id);
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
            style={[styles.tab, tab === 'seguidores' && { backgroundColor: colors.primary }]}
            onPress={() => setTab('seguidores')}
          >
            <ThemedText style={[styles.tabText, tab === 'seguidores' && { color: '#fff' }]}>
              {seguidoresNoSeguidos.length > 0
                ? `Seguidores (${seguidoresNoSeguidos.length})`
                : 'Seguidores'}
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
      ) : tab === 'seguidores' ? (
        loadingSeguidores ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <FlatList
            data={seguidoresNoSeguidos}
            keyExtractor={(item) => item.id}
            renderItem={renderFollowerBack}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <ThemedText style={styles.empty}>
                No hay nadie que te siga sin que tú les sigas.
              </ThemedText>
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
  header: { padding: 16, paddingBottom: 0, gap: 12 },
  tabs: { flexDirection: 'row', borderRadius: 999, padding: 4, gap: 4, marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center' },
  tabText: { fontWeight: '600', fontSize: 13 },
  list: { padding: 16, gap: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, padding: 12, gap: 12 },
  userRowInner: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  userInfo: { flex: 1 },
  userName: { fontWeight: '600', fontSize: 15 },
  subText: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', opacity: 0.5, marginTop: 32 },
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
