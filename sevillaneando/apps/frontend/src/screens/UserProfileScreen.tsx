import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getUserProfile } from '../services';
import { Avatar, ThemedButton, ThemedText, ThemedTitle, ThemedView } from '../components';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import type { PublicUser } from '../types/user';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

export const UserProfileScreen: React.FC<Props> = ({ route, navigation }) => {
  const { userId } = route.params;
  const { colors } = useTheme();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicUser | null>(null);

  useEffect(() => {
    let mounted = true;
    getUserProfile(userId)
      .then((data) => {
        if (mounted) setProfile(data);
      })
      .catch(() => {
        if (mounted) setProfile(null);
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedView style={[styles.card, { backgroundColor: colors.card }]}>
        <Avatar photoUrl={profile?.fotoPerfil} size={96} style={styles.avatar} />
        <ThemedTitle style={{ marginTop: 8 }}>
          {profile?.nombre ?? 'Usuario'}
        </ThemedTitle>
        {!!profile?.intereses?.length && (
          <ThemedText style={{ marginTop: 6 }}>
            Intereses: {profile.intereses.join(', ')}
          </ThemedText>
        )}
        {user?.id !== userId && (
          <ThemedButton
            title="Enviar mensaje privado"
            onPress={() =>
              navigation.navigate('DirectMessage', {
                userId,
                userName: profile?.nombre ?? 'Usuario',
              })
            }
          />
        )}
      </ThemedView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: { borderRadius: 16, padding: 16, alignItems: 'center', gap: 8 },
  avatar: {},
});
