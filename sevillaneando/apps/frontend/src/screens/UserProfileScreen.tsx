import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import {
  getUserProfile,
  seguirUsuario,
  dejarDeSeguirUsuario,
  checkSiguiendo,
  getSeguidos,
  getSeguidores,
} from '../services/users';
import { Avatar, ThemedButton, ThemedText, ThemedTitle, ThemedView } from '../components';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services';
import type { PublicUser } from '../types/user';
import type { Event } from '../types/event';
import { getFullImageUrl } from '../utils/imageUrl';
import dayjs from 'dayjs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

type EventCardProps = {
  item: Event;
  colors: ReturnType<typeof useTheme>['colors'];
  navigation: Props['navigation'];
};

const EventCard: React.FC<EventCardProps> = ({ item, colors, navigation }) => {
  const [imgError, setImgError] = useState(false);
  const imageUrl = getFullImageUrl(item.imagen);

  return (
    <TouchableOpacity
      style={[styles.eventCard, { backgroundColor: colors.card }]}
      onPress={() => navigation.navigate('EventDetail', { event: item })}
    >
      {imageUrl && !imgError ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.eventImage}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <View
          style={[
            styles.eventImage,
            styles.eventImagePlaceholder,
            { backgroundColor: colors.primary + '22' },
          ]}
        >
          <Image
            source={require('../../assets/icon.png')}
            style={styles.eventImageDefault}
            resizeMode="contain"
          />
        </View>
      )}
      <View style={styles.eventInfo}>
        <ThemedText style={styles.eventTitle} numberOfLines={1}>
          {item.title}
        </ThemedText>
        {item.fechaInicio && (
          <ThemedText style={styles.eventDate}>
            {dayjs(item.fechaInicio).format('DD MMM YYYY, HH:mm')}
          </ThemedText>
        )}
        <ThemedText style={styles.eventAddress} numberOfLines={1}>
          {item.address}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );
};

export const UserProfileScreen: React.FC<Props> = ({ route, navigation }) => {
  const { userId } = route.params;
  const { colors } = useTheme();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [siguiendo, setSiguiendo] = useState(false);
  const [numSeguidores, setNumSeguidores] = useState(0);
  const [numSeguidos, setNumSeguidos] = useState(0);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [eventosAsistidos, setEventosAsistidos] = useState<Event[]>([]);

  const esPropioPerfil = user?.id === userId;

  useEffect(() => {
    let mounted = true;

    getUserProfile(userId)
      .then((data) => {
        if (mounted) setProfile(data);
      })
      .catch(() => {
        if (mounted) setProfile(null);
      });

    getSeguidores(userId)
      .then((list) => {
        if (mounted) setNumSeguidores(list.length);
      })
      .catch(() => {});

    getSeguidos(userId)
      .then((list) => {
        if (mounted) setNumSeguidos(list.length);
      })
      .catch(() => {});

    api
      .get(`/events/attending/${userId}`)
      .then((res) => {
        if (mounted) setEventosAsistidos(res.data as Event[]);
      })
      .catch(() => {});

    if (!esPropioPerfil) {
      checkSiguiendo(userId)
        .then((val) => {
          if (mounted) setSiguiendo(val);
        })
        .catch(() => {});
    }

    return () => {
      mounted = false;
    };
  }, [userId, esPropioPerfil]);

  const toggleSeguir = async () => {
    setLoadingFollow(true);
    try {
      if (siguiendo) {
        await dejarDeSeguirUsuario(userId);
        setSiguiendo(false);
        setNumSeguidores((n) => Math.max(0, n - 1));
      } else {
        await seguirUsuario(userId);
        setSiguiendo(true);
        setNumSeguidores((n) => n + 1);
      }
    } finally {
      setLoadingFollow(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={eventosAsistidos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListHeaderComponent={
          <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
            <Avatar photoUrl={profile?.fotoPerfil} size={96} style={styles.avatar} />
            <ThemedTitle style={{ marginTop: 8 }}>{profile?.nombre ?? 'Usuario'}</ThemedTitle>

            <View style={styles.statsRow}>
              <TouchableOpacity
                style={styles.stat}
                onPress={() =>
                  navigation.navigate('ProfileConnections', { userId, type: 'seguidores' })
                }
              >
                <ThemedText style={styles.statNumber}>{numSeguidores}</ThemedText>
                <ThemedText style={styles.statLabel}>seguidores</ThemedText>
              </TouchableOpacity>
              <View style={[styles.statDivider, { backgroundColor: colors.border ?? '#ccc' }]} />
              <TouchableOpacity
                style={styles.stat}
                onPress={() =>
                  navigation.navigate('ProfileConnections', { userId, type: 'seguidos' })
                }
              >
                <ThemedText style={styles.statNumber}>{numSeguidos}</ThemedText>
                <ThemedText style={styles.statLabel}>seguidos</ThemedText>
              </TouchableOpacity>
            </View>

            {!!profile?.intereses?.length && (
              <ThemedText style={{ marginTop: 6, textAlign: 'center' }}>
                Intereses: {profile.intereses.join(', ')}
              </ThemedText>
            )}

            {!esPropioPerfil && (
              <View style={styles.actions}>
                <ThemedButton
                  title={loadingFollow ? '' : siguiendo ? 'Dejar de seguir' : 'Seguir'}
                  icon={
                    <Icon
                      name={siguiendo ? 'account-check' : 'account-plus'}
                      size={18}
                      color="#FFFFFF"
                    />
                  }
                  style={styles.primaryActionButton}
                  onPress={toggleSeguir}
                  disabled={loadingFollow}
                />
                {loadingFollow && <ActivityIndicator style={StyleSheet.absoluteFill} />}
                <ThemedButton
                  title="Enviar mensaje privado"
                  variant="secondary"
                  icon={<Icon name="message-text-outline" size={18} color={colors.primary} />}
                  style={[styles.secondaryActionButton, { borderColor: colors.primary }]}
                  onPress={() =>
                    navigation.navigate('DirectMessage', {
                      userId,
                      userName: profile?.nombre ?? 'Usuario',
                    })
                  }
                />
              </View>
            )}

            {eventosAsistidos.length > 0 && (
              <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
                Eventos a los que asiste
              </ThemedText>
            )}
          </ThemedView>
        }
        renderItem={({ item }) => <EventCard item={item} colors={colors} navigation={navigation} />}
        ListEmptyComponent={null}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { borderRadius: 16, padding: 16, alignItems: 'center', gap: 8, marginBottom: 8 },
  avatar: {},
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 16 },
  stat: { alignItems: 'center', minWidth: 60 },
  statNumber: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 12, opacity: 0.7 },
  statDivider: { width: 1, height: 32 },
  actions: { width: '100%', gap: 10, marginTop: 10 },
  primaryActionButton: {
    paddingVertical: 14,
    borderRadius: 999,
  },
  secondaryActionButton: {
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  sectionTitle: { fontWeight: 'bold', fontSize: 15, marginTop: 12, alignSelf: 'flex-start' },
  eventCard: { borderRadius: 12, flexDirection: 'row', overflow: 'hidden', marginBottom: 2 },
  eventImage: { width: 80, height: 80 },
  eventImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  eventImageDefault: { width: 56, height: 56 },
  eventInfo: { flex: 1, padding: 10, justifyContent: 'center', gap: 2 },
  eventTitle: { fontWeight: 'bold', fontSize: 14 },
  eventDate: { fontSize: 12, opacity: 0.7 },
  eventAddress: { fontSize: 11, opacity: 0.6 },
});
