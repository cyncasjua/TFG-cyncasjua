export const SEVILLA_TIME_ZONE = 'Europe/Madrid';

function hasExplicitTimezone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
}

function parseBackendDateString(value: string): Date {
  const normalized = value.trim();
  const isoLike = normalized.replace(' ', 'T');

  if (!hasExplicitTimezone(isoLike)) {
    const asUtc = new Date(`${isoLike}Z`);
    if (!isNaN(asUtc.getTime())) {
      return asUtc;
    }
  }

  return new Date(isoLike);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function getLastSundayOfMonth(year: number, monthIndex: number): number {
  const lastDayUtc = new Date(Date.UTC(year, monthIndex + 1, 0));
  const dayOfWeek = lastDayUtc.getUTCDay();
  return lastDayUtc.getUTCDate() - dayOfWeek;
}

function isSevillaDst(utcDate: Date): boolean {
  const year = utcDate.getUTCFullYear();
  const marchLastSunday = getLastSundayOfMonth(year, 2);
  const octoberLastSunday = getLastSundayOfMonth(year, 9);

  // Europe/Madrid switches at 01:00 UTC.
  const dstStartUtc = Date.UTC(year, 2, marchLastSunday, 1, 0, 0, 0);
  const dstEndUtc = Date.UTC(year, 9, octoberLastSunday, 1, 0, 0, 0);
  const currentUtc = utcDate.getTime();

  return currentUtc >= dstStartUtc && currentUtc < dstEndUtc;
}

function getSevillaOffsetMinutes(utcDate: Date): number {
  return isSevillaDst(utcDate) ? 120 : 60;
}

function toSevillaClockDate(value: Date | string | number): Date {
  const utcDate = toDate(value);
  const offsetMinutes = getSevillaOffsetMinutes(utcDate);
  return new Date(utcDate.getTime() + offsetMinutes * 60 * 1000);
}

function toDate(value: Date | string | number): Date {
  const date = typeof value === 'string' ? parseBackendDateString(value) : new Date(value);
  if (isNaN(date.getTime())) {
    return new Date(0);
  }
  return date;
}

export function getSevillaDayKey(value: Date | string | number): string {
  const date = toSevillaClockDate(value);
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  return `${year}-${month}-${day}`;
}

export function formatSevillaTime(value: Date | string | number): string {
  const date = toSevillaClockDate(value);
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

export function formatSevillaDateTime(value: Date | string | number): string {
  const date = toSevillaClockDate(value);
  const day = pad2(date.getUTCDate());
  const month = pad2(date.getUTCMonth() + 1);
  const year = date.getUTCFullYear();
  const hour = pad2(date.getUTCHours());
  const minute = pad2(date.getUTCMinutes());
  return `${day}/${month}/${year}, ${hour}:${minute}`;
}
