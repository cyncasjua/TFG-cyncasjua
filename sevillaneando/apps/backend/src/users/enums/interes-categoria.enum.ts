export enum InteresCategoriaEnum {
  MUSICA = 'musica',
  ARTE = 'arte',
  GASTRONOMIA = 'gastronomia',
  OCIO = 'ocio',
  DEPORTE = 'deporte',
  FAMILIA = 'familia',
  TURISMO = 'turismo',
  TECNOLOGIA = 'tecnologia',
  NEGOCIOS = 'negocios',
  EDUCACION = 'educacion',
  BIENESTAR = 'bienestar',
  CINE = 'cine',
  TEATRO = 'teatro',
  FIESTAS = 'fiestas',
}

const INTERES_MAP: Record<string, InteresCategoriaEnum> = {
  musica: InteresCategoriaEnum.MUSICA,
  arte: InteresCategoriaEnum.ARTE,
  gastronomia: InteresCategoriaEnum.GASTRONOMIA,
  ocio: InteresCategoriaEnum.OCIO,
  deporte: InteresCategoriaEnum.DEPORTE,
  familia: InteresCategoriaEnum.FAMILIA,
  turismo: InteresCategoriaEnum.TURISMO,
  tecnologia: InteresCategoriaEnum.TECNOLOGIA,
  negocios: InteresCategoriaEnum.NEGOCIOS,
  educacion: InteresCategoriaEnum.EDUCACION,
  bienestar: InteresCategoriaEnum.BIENESTAR,
  cine: InteresCategoriaEnum.CINE,
  teatro: InteresCategoriaEnum.TEATRO,
  fiestas: InteresCategoriaEnum.FIESTAS,
};

export function normalizeInteres(value: unknown): InteresCategoriaEnum | null {
  if (typeof value !== 'string') return null;

  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  return INTERES_MAP[normalized] ?? null;
}

export function normalizeIntereses(values: unknown): InteresCategoriaEnum[] {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => normalizeInteres(value))
    .filter((value): value is InteresCategoriaEnum => value !== null);
}
