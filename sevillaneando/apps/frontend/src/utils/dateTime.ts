import dayjs from 'dayjs';

export const formatDateTime = (value: string): string =>
  value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '';

// Devuelve el offset de Europe/Madrid (en minutos) para un instante dado,
// usando las reglas DST de la UE: último domingo de marzo a último domingo
// de octubre → CEST (+120 min); resto del año → CET (+60 min).
// Implementación manual para no depender de los datos de zona del runtime
// (Hermes/RN no incluye ICU completo).
const madridOffsetMinutes = (year: number, month: number, day: number, hour: number, minute: number): number => {
  // último domingo de marzo
  const marchLast = new Date(Date.UTC(year, 2, 31));
  const dstStart = new Date(Date.UTC(year, 2, 31 - marchLast.getUTCDay(), 1, 0)); // 01:00 UTC
  // último domingo de octubre
  const octLast = new Date(Date.UTC(year, 9, 31));
  const dstEnd = new Date(Date.UTC(year, 9, 31 - octLast.getUTCDay(), 1, 0)); // 01:00 UTC

  // Comparamos en hora local de Madrid: dentro de DST si CEST a la fecha local
  // ya pasó el cambio. Aproximamos: si la fecha local cae entre las 02:00 del
  // último domingo de marzo y las 03:00 del último domingo de octubre.
  const localTs = Date.UTC(year, month - 1, day, hour, minute);
  // Cambio a CEST: 02:00 local CET = 01:00 UTC
  const startLocal = dstStart.getTime() + 2 * 3600_000; // 02:00 local
  // Cambio a CET: 03:00 local CEST = 01:00 UTC
  const endLocal = dstEnd.getTime() + 3 * 3600_000; // 03:00 local
  return localTs >= startLocal && localTs < endLocal ? 120 : 60;
};

const formatOffset = (totalMinutes: number): string => {
  const sign = totalMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(totalMinutes);
  const h = String(Math.floor(abs / 60)).padStart(2, '0');
  const m = String(abs % 60).padStart(2, '0');
  return `${sign}${h}:${m}`;
};

// Convierte "YYYY-MM-DD HH:mm" (hora local de Madrid) a un ISO con offset
// explícito (+01:00 o +02:00), para que el backend guarde el instante
// correcto independientemente de su zona horaria.
export const toBackendDateTime = (value: string): string | undefined => {
  if (!value) return undefined;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) return value; // ya tiene zona
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return value;
  const [, y, mo, d, h, mi, s] = m;
  const offset = madridOffsetMinutes(+y, +mo, +d, +h, +mi);
  return `${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}${formatOffset(offset)}`;
};

export const updateDateKeepingTime = (currentValue: string, pickedDate: Date): string => {
  const prev = currentValue ? dayjs(currentValue) : dayjs();
  return dayjs(pickedDate).hour(prev.hour()).minute(prev.minute()).format('YYYY-MM-DD HH:mm');
};

export const updateTimeKeepingDate = (currentValue: string, pickedTime: Date): string => {
  const prev = currentValue ? dayjs(currentValue) : dayjs();
  return prev
    .hour(dayjs(pickedTime).hour())
    .minute(dayjs(pickedTime).minute())
    .format('YYYY-MM-DD HH:mm');
};
