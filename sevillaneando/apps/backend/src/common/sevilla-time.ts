export const SEVILLA_TIME_ZONE = 'Europe/Madrid';

export function getSevillaDayKey(value: Date | string | number): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error('Fecha invalida para calcular dia de Sevilla.');
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SEVILLA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('No se pudo formatear dia de Sevilla.');
  }

  return `${year}-${month}-${day}`;
}
