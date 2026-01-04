import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

export const ThemedView = ({ style, ...props }: ViewProps) => {
  const { colors } = useTheme();
  return <View style={[{ backgroundColor: colors.background }, style]} {...props} />;
};

export const ThemedCard = ({ style, ...props }: ViewProps) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border
        },
        style
      ]}
      {...props}
    />
  );
};
