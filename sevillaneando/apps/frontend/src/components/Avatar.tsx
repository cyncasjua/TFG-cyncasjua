import React, { useEffect, useMemo, useState } from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
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

  useEffect(() => {
    console.log('[Avatar] photoUrl prop:', {
      photoUrl,
      isNull: photoUrl === null,
      isUndefined: photoUrl === undefined,
      candidatesCount: candidates.length,
      firstCandidate: candidates[0]
    });
    setCandidateIndex(0);
  }, [photoUrl]);

  const avatarUri = candidates[candidateIndex];

  return (
    <Image
      source={avatarUri ? { uri: avatarUri } : defaultProfileImage}
      onError={() => {
        setCandidateIndex((prev) => {
          if (prev >= candidates.length) return prev;
          return prev + 1;
        });
      }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
};
