import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, TextStyle, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface ThemedButtonProps extends TouchableOpacityProps {
  title?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  textStyle?: TextStyle;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const ThemedButton = ({
  title,
  variant = 'primary',
  style,
  textStyle,
  icon,
  children,
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

  // Display children (text content) or title
  const displayText = children || title;
  const hasIcon = !!icon;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: variant === 'secondary' ? colors.border : 'transparent',
          borderWidth: variant === 'secondary' ? 1 : 0,
        },
        style,
      ]}
      {...props}
    >
      <View style={styles.content}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        {displayText && (
          <Text style={[styles.text, { color: getTextColor() }, textStyle]} numberOfLines={1}>
            {displayText}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
});
