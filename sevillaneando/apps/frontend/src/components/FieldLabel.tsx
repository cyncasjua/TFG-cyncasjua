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

export const FieldLabel: React.FC<Props> = ({ title, status, badgeText, helperText }) => {
  const { colors } = useTheme();
  const isHighlighted = status === 'required' || status === 'choice' || status === 'automatic';
  const metaColor = isHighlighted ? colors.primary : colors.textSecondary;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {isHighlighted && <View style={[styles.marker, { backgroundColor: colors.primary }]} />}
        <ThemedText style={styles.title}>{title}</ThemedText>
        <ThemedTextSecondary style={[styles.meta, { color: metaColor }]}>
          {badgeText ?? badgeCopy[status]}
        </ThemedTextSecondary>
      </View>
      {!!helperText && (
        <ThemedTextSecondary style={[styles.helper, { color: colors.textSecondary }]}>
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
  },
  marker: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 7,
  },
  title: {
    fontWeight: '700',
  },
  meta: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  helper: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
  },
});
