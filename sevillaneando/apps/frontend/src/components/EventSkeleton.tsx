import React, { useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../hooks/useTheme';

const SKELETON_HEIGHT = 180;
const BORDER_RADIUS = 18;

export const EventSkeleton: React.FC = () => {
  const { theme } = useTheme();
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ]),
    ).start();
  }, [shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const backgroundColor = theme === 'dark' ? '#2a2a2a' : '#e8e8e8';

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.skeleton,
          {
            backgroundColor,
            opacity: shimmerOpacity,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    paddingHorizontal: 0,
  },
  skeleton: {
    height: SKELETON_HEIGHT,
    borderRadius: BORDER_RADIUS,
    overflow: 'hidden',
  },
});
