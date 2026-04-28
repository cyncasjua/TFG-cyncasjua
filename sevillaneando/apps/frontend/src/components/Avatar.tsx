import React, { useEffect, useMemo, useState } from 'react';
import { Image, ImageStyle, StyleProp, View, ActivityIndicator } from 'react-native';
import { getImageUrlCandidates } from '../utils/imageUrl';

type Props = {
  photoUrl?: string | null;
  size: number;
  style?: StyleProp<ImageStyle>;
};

const defaultProfileImage = require('../../assets/icon.png');

export const Avatar: React.FC<Props> = ({ photoUrl, size, style }) => {
  const candidates = useMemo(() => getImageUrlCandidates(photoUrl), [photoUrl]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
  }, [photoUrl]);

  const avatarUri = candidates[candidateIndex];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      {isLoading && (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#f0f0f0' + '99',
            zIndex: 10,
          }}
        >
          <ActivityIndicator size="small" color="#6c2eb7" />
        </View>
      )}
      <Image
        source={avatarUri ? { uri: avatarUri } : defaultProfileImage}
        onError={() => {
          setCandidateIndex((prev) => {
            if (prev >= candidates.length) return prev;
            return prev + 1;
          });
        }}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
      />
    </View>
  );
};
