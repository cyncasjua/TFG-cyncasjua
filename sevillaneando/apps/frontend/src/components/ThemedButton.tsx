import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, TextStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface ThemedButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
  textStyle?: TextStyle;
}

export const ThemedButton = ({ 
  title, 
  variant = 'primary', 
  style, 
  textStyle,
  ...props 
}: ThemedButtonProps) => {
  const { colors } = useTheme();

  const getBackgroundColor = () => {
    switch (variant) {
      case 'danger':
        return colors.error;
      case 'secondary':
        return colors.card;
      case 'primary':
      default:
        return colors.primary;
    }
  };

  const getTextColor = () => {
    return variant === 'secondary' ? colors.text : '#FFFFFF';
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { 
          backgroundColor: getBackgroundColor(),
          borderColor: variant === 'secondary' ? colors.border : 'transparent',
          borderWidth: variant === 'secondary' ? 1 : 0
        },
        style
      ]}
      {...props}
    >
      <Text style={[styles.text, { color: getTextColor() }, textStyle]} numberOfLines={1}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center'
  }
});
