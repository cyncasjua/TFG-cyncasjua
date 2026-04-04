import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { getFullImageUrl } from '../utils/imageUrl';

type Props = {
  photoUrl?: string | null;
  size: number;
  style?: StyleProp<ImageStyle>;
};

const defaultProfileImage = require('../../assets/icon.png');

export const Avatar: React.FC<Props> = ({ photoUrl, size, style }) => {
  const resolvedUri = photoUrl ? getFullImageUrl(photoUrl) || photoUrl : null;

  return (
    <Image
      source={resolvedUri ? { uri: resolvedUri } : defaultProfileImage}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
};
