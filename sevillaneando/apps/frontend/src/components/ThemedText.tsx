import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export const ThemedText = ({ style, ...props }: TextProps) => {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.text }, style]} {...props} />;
};

export const ThemedTextSecondary = ({ style, ...props }: TextProps) => {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.textSecondary, fontSize: 14 }, style]} {...props} />;
};

export const ThemedTitle = ({ style, ...props }: TextProps) => {
  const { colors } = useTheme();
  return (
    <Text style={[{ color: colors.text, fontSize: 24, fontWeight: 'bold' }, style]} {...props} />
  );
};
