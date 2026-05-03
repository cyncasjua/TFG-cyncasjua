/**
 * Convierte una URL de imagen (relativa o absoluta) a una URL completa
 * @param url - URL de la imagen (relativa como "/uploads/..." o absoluta)
 * @returns URL completa de la imagen
 */
function maybeEncodeUrl(rawUrl: string): string {
  return rawUrl.includes(' ') ? encodeURI(rawUrl) : rawUrl;
}

function sanitizeRawUrl(raw: string): string {
  let value = raw.trim();

  const startsWithDouble = value[0] === '"' && value[value.length - 1] === '"';
  const startsWithSingle = value[0] === "'" && value[value.length - 1] === "'";
  if (startsWithDouble || startsWithSingle) {
    value = value.slice(1, -1).trim();
  }

  value = value.replace(/\\\//g, '/').replace(/\//g, '/');

  if (/^https?:\/[^/]/i.test(value)) {
    value = value.replace(/^https?:\//i, (m) => `${m}/`);
  }

  return value;
}

function getApiOrigin(): string | undefined {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) return undefined;
  try {
    return new URL(apiUrl).origin;
  } catch {
    return undefined;
  }
}

function normalizeAbsoluteUrl(rawUrl: string): string {
  let normalized = rawUrl;

  if (/^res\.cloudinary\.com\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  if (normalized.startsWith('//')) {
    normalized = `https:${normalized}`;
  }

  const apiOrigin = getApiOrigin();
  if (!apiOrigin) return normalized;

  try {
    const parsed = new URL(normalized);
    const isLoopback =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '0.0.0.0';

    if (!isLoopback) return normalized;

    const apiParsed = new URL(apiOrigin);
    parsed.protocol = apiParsed.protocol;
    parsed.hostname = apiParsed.hostname;
    parsed.port = apiParsed.port;

    return parsed.toString();
  } catch {
    return normalized;
  }
}

function optimizeCloudinaryUrl(rawUrl: string): string {
  if (!/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (!rawUrl.includes('res.cloudinary.com') || !rawUrl.includes('/image/upload/')) return rawUrl;
  if (rawUrl.includes('/s--')) return rawUrl;

  const marker = '/image/upload/';
  const markerIndex = rawUrl.indexOf(marker);
  if (markerIndex === -1) return rawUrl;

  const prefix = rawUrl.slice(0, markerIndex + marker.length);
  const suffix = rawUrl.slice(markerIndex + marker.length);
  if (!suffix) return rawUrl;

  const firstSegment = suffix.split('/')[0] || '';
  const hasFormatTransform = /(^|,)f_/.test(firstSegment);
  const hasQualityTransform = /(^|,)q_/.test(firstSegment);

  if (hasFormatTransform || hasQualityTransform) {
    return rawUrl;
  }

  return `${prefix}f_auto,q_auto/${suffix}`;
}

export function getFullImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;

  let trimmed = sanitizeRawUrl(url);
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return undefined;

  if (/^res\.cloudinary\.com\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  if (/^[a-z0-9.-]+(?::\d+)?\//i.test(trimmed) && !trimmed.startsWith('/')) {
    if (/^localhost(?::\d+)?\//i.test(trimmed)) {
      trimmed = `http://${trimmed}`;
    } else {
      trimmed = `https://${trimmed}`;
    }
  }

  const supportedScheme = /^(https?:|file:|content:|ph:|asset-library:|data:)/i;

  if (!supportedScheme.test(trimmed) && !trimmed.startsWith('/')) {
    const cloudinaryIndex = trimmed.toLowerCase().indexOf('res.cloudinary.com/');
    if (cloudinaryIndex >= 0) {
      trimmed = `https://${trimmed.slice(cloudinaryIndex)}`;
      const normalizedCloudinary = normalizeAbsoluteUrl(trimmed);
      const result = maybeEncodeUrl(optimizeCloudinaryUrl(normalizedCloudinary));
      return result;
    }

    const normalizedRelative = `/${trimmed.replace(/^\/+/, '')}`;
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    const result = maybeEncodeUrl(`${apiUrl}${normalizedRelative}`);
    return result;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const normalizedAbsolute = normalizeAbsoluteUrl(trimmed);
    const result = maybeEncodeUrl(optimizeCloudinaryUrl(normalizedAbsolute));
    return result;
  }

  if (trimmed.startsWith('/')) {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
    const result = maybeEncodeUrl(`${apiUrl}${trimmed}`);
    return result;
  }

  return maybeEncodeUrl(trimmed);
}

/**
 * Obtiene una URL de imagen optimizada para chat (thumbnail comprimido)
 * Reduce el tamaño y compresión para cargar más rápido en listados
 */
export function getOptimizedChatImageUrl(url?: string | null): string | undefined {
  const fullUrl = getFullImageUrl(url);
  if (!fullUrl) return undefined;

  // Si es una URL de Cloudinary, agregar parámetros de optimización
  if (fullUrl.includes('res.cloudinary.com')) {
    // Insertar transformaciones después del identificador de upload
    const uploadIndex = fullUrl.indexOf('/upload/');
    if (uploadIndex !== -1) {
      const before = fullUrl.substring(0, uploadIndex + 8); // /upload/ = 8 caracteres
      const after = fullUrl.substring(uploadIndex + 8);

      // w_500: ancho máximo 500px, q_60: compresión más agresiva, f_auto: formato automático
      return `${before}w_500,q_60,f_auto/${after}`;
    }
  }

  return fullUrl;
}

export function getImageUrlCandidates(url?: string | null): string[] {
  if (!url) return [];

  const raw = sanitizeRawUrl(url);
  if (!raw || raw === 'null' || raw === 'undefined') return [];

  const candidates: string[] = [];
  const add = (value?: string) => {
    if (!value) return;
    const normalized = maybeEncodeUrl(value.trim());
    if (!normalized) return;
    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  add(getFullImageUrl(raw));

  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

  if (raw.startsWith('//')) {
    add(`https:${raw}`);
  }

  if (raw.startsWith('/')) {
    add(`${apiUrl}${raw}`);
  }

  if (/^res\.cloudinary\.com\//i.test(raw)) {
    add(`https://${raw}`);
  }

  const cloudinaryIndex = raw.toLowerCase().indexOf('res.cloudinary.com/');
  if (cloudinaryIndex >= 0) {
    add(`https://${raw.slice(cloudinaryIndex)}`);
  }

  const hasScheme = /^(https?:|file:|content:|ph:|asset-library:|data:)/i.test(raw);
  if (hasScheme) {
    add(raw);
  }

  if (!hasScheme && !raw.startsWith('/')) {
    if (/^localhost(?::\d+)?\//i.test(raw)) {
      add(`http://${raw}`);
    } else if (/^[a-z0-9.-]+(?::\d+)?\//i.test(raw)) {
      add(`https://${raw}`);
    }
    add(`${apiUrl}/${raw.replace(/^\/+/, '')}`);
  }

  return candidates;
}
