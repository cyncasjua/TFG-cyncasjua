export const parseEventImages = (imagenes: unknown): string[] => {
  if (!imagenes) return [];

  if (Array.isArray(imagenes)) {
    return imagenes.filter((url): url is string => typeof url === 'string' && url.trim().length > 0);
  }

  if (typeof imagenes === 'string') {
    if (imagenes.startsWith('[')) {
      try {
        const parsed = JSON.parse(imagenes);
        if (Array.isArray(parsed)) {
          return parsed.filter((url): url is string => typeof url === 'string' && url.trim().length > 0);
        }
      } catch {
        return [];
      }
    }

    return imagenes
      .split(',')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);
  }

  return [];
};

export const stringifyEventImages = (imagenes: unknown): string => JSON.stringify(parseEventImages(imagenes));

export const countEventImages = (imagenes: unknown): number => parseEventImages(imagenes).length;
