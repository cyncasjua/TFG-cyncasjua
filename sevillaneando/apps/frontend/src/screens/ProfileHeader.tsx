import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '../components/ThemedText'; 
import { useAuth } from '../hooks/useAuth';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';

type Props = {
  onPress?: () => void;
};

export const ProfileHeader: React.FC<Props> = ({ onPress }) => {
  const { user } = useAuth();
  const { colors } = useTheme();

  return (
    <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.8}>
      <Image
        source={
          user?.fotoPerfil
            ? { uri: user.fotoPerfil }
            : { uri: 'https://ui-avatars.com/api/?name=Perfil' } 
        }
        style={styles.avatar}
      />
      <View style={styles.nameRow}>
        <ThemedText style={styles.name}>{user?.nombre || 'Mi perfil'}</ThemedText>
        <Feather name="edit-2" size={14} color="#888" style={{ marginLeft: 6 }} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  name: { fontWeight: 'bold', fontSize: 16 },
  pencilIcon: { padding: 2 },
});