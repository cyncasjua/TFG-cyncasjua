import React from 'react';
import { Linking, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { useTheme } from '../hooks/useTheme';

type Props = {
  compact?: boolean;
};

export const OsmAttribution: React.FC<Props> = ({ compact = false }) => {
  const { colors } = useTheme();

  const openOsmCredits = () => {
    Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => {
      // Intentionally ignored: failing to open browser should not block UI.
    });
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.card + 'E8', borderColor: colors.border }]}>
      <TouchableOpacity onPress={openOsmCredits} activeOpacity={0.8}>
        <ThemedText style={[styles.text, compact && styles.compactText]}>
          Map data © OpenStreetMap contributors, ODbL 1.0
        </ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  compactText: {
    fontSize: 11,
  },
});
