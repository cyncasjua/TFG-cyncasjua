import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { ThemedText, ThemedTextSecondary } from './ThemedText';

type FieldLabelStatus = 'required' | 'optional' | 'automatic' | 'readonly' | 'choice';

type Props = {
  title: string;
  status: FieldLabelStatus;
  badgeText?: string;
  helperText?: string;
};

const badgeCopy: Record<FieldLabelStatus, string> = {
  required: 'Obligatorio',
  optional: 'Opcional',
  automatic: 'Automático',
  readonly: 'Solo lectura',
  choice: 'Opción',
};

const badgeColors: Record<FieldLabelStatus, { background: string; text: string }> = {
  required: { background: '#FDECEC', text: '#B42318' },
  optional: { background: '#EEF2F6', text: '#475467' },
  automatic: { background: '#EAF2FF', text: '#175CD3' },
  readonly: { background: '#F2F4F7', text: '#344054' },
  choice: { background: '#ECFDF3', text: '#067647' },
};

export const FieldLabel: React.FC<Props> = ({ title, status, badgeText, helperText }) => {
  const { colors } = useTheme();
  const badge = badgeColors[status];

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <View style={[styles.badge, { backgroundColor: badge.background }]}>
          <ThemedText style={[styles.badgeText, { color: badge.text }]}>
            {badgeText ?? badgeCopy[status]}
          </ThemedText>
        </View>
      </View>
      {!!helperText && (
        <ThemedTextSecondary style={[styles.helper, { color: colors.text + '88' }]}>
          {helperText}
        </ThemedTextSecondary>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    fontWeight: '700',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  helper: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
  },
});
