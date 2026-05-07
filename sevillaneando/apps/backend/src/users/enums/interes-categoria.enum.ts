export type InteresCategoria = string;

export function normalizeInteres(value: unknown): InteresCategoria | null {
  if (typeof value !== 'string') return null;

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function normalizeIntereses(values: unknown): InteresCategoria[] {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => normalizeInteres(value))
    .filter((value): value is InteresCategoria => value !== null);
}
