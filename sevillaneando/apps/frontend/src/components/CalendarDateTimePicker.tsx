import React, { useState, useEffect } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from 'react-native-ui-datepicker';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useTheme } from '../hooks/useTheme';
import { ThemedText } from './ThemedText';
import { ThemedButton } from './ThemedButton';

dayjs.extend(utc);
dayjs.extend(timezone);

interface Props {
  isVisible: boolean;
  value: string;
  minimumDate?: Date;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

// Trabajamos siempre en UTC para evitar desfases de la librería.
// El "valor" que viaja por la app es un string "YYYY-MM-DD HH:mm" que
// representa la hora elegida tal cual (sin zona). Internamente lo
// interpretamos como UTC para que la librería no le sume/reste offset.
const toUtcDate = (v: string): Date => {
  // "YYYY-MM-DD HH:mm" sin zona → reinterpretar como UTC
  const plain = v.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (plain) {
    const [, y, mo, d, h, mi] = plain.map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h, mi));
  }
  // ISO con Z o con offset → tomar el instante real y mostrarlo en hora local
  // del usuario, pero anclado a UTC para la librería.
  const d = new Date(v);
  if (isNaN(d.getTime())) return new Date();
  return new Date(Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
  ));
};

const formatFromUtc = (d: Date): string => {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${y}-${mo}-${da} ${h}:${mi}`;
};

const minimumToUtc = (min?: Date): Date | undefined => {
  if (!min) return undefined;
  // El usuario nos pasa un Date en hora local; lo "trasladamos" a UTC
  // conservando los campos visibles para que la librería compare bien.
  return new Date(Date.UTC(
    min.getFullYear(),
    min.getMonth(),
    min.getDate(),
    min.getHours(),
    min.getMinutes(),
  ));
};

export const CalendarDateTimePicker: React.FC<Props> = ({
  isVisible,
  value,
  minimumDate,
  onConfirm,
  onCancel,
}) => {
  const { colors } = useTheme();

  const [selected, setSelected] = useState<Date>(
    value ? toUtcDate(value) : new Date()
  );

  useEffect(() => {
    if (isVisible) {
      setSelected(value ? toUtcDate(value) : new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay} pointerEvents="box-none">
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onCancel}
        />
        <View style={[styles.container, { backgroundColor: colors.card }]}>
          <ThemedText style={styles.title}>Selecciona fecha y hora</ThemedText>
          <DateTimePicker
            mode="single"
            timeZone="UTC"
            date={selected}
            onChange={({ date }: { date: any }) => {
              if (!date) return;
              // Con timeZone="UTC" la librería entrega el Date alineado a UTC.
              // Lo guardamos tal cual; al confirmar leemos los campos UTC.
              const d = dayjs(date).toDate();
              setSelected(d);
            }}
            minDate={minimumToUtc(minimumDate)}
            locale="es"
            timePicker
            styles={{
              today: { borderColor: colors.primary },
              today_label: { color: colors.primary },
              selected: { backgroundColor: colors.primary, borderRadius: 999 },
              selected_label: { color: '#fff' },
              day_label: { color: colors.text },
              weekday_label: { color: colors.text },
              month_selector_label: { color: colors.text },
              year_selector_label: { color: colors.text },
              time_selector_label: { color: colors.text },
              time_label: { color: colors.text },
              button_next_image: { tintColor: colors.text },
              button_prev_image: { tintColor: colors.text },
              time_selected_indicator: { backgroundColor: colors.primary + '33', borderRadius: 999 },
            }}
          />
          <View style={styles.buttons}>
            <ThemedButton onPress={onCancel} style={styles.btn}>
              Cancelar
            </ThemedButton>
            <ThemedButton
              onPress={() => onConfirm(formatFromUtc(selected))}
              style={styles.btn}
            >
              Aceptar
            </ThemedButton>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    borderRadius: 16,
    padding: 16,
    width: 340,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  btn: {
    flex: 1,
  },
});
