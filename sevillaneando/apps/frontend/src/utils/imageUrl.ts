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

    // Elimina comillas envolventes que a veces llegan serializadas.
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        value = value.slice(1, -1).trim();
    }

    // Normaliza barras escapadas en strings JSON persistidos.
    value = value.replace(/\\\//g, '/').replace(/\//g, '/');

    // Corrige esquemas incompletos tipo https:/dominio.com.
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

    // Soporta URLs sin esquema como "res.cloudinary.com/...".
    if (/^res\.cloudinary\.com\//i.test(normalized)) {
        normalized = `https://${normalized}`;
    }

    // Soporta URLs protocol-relative: //res.cloudinary.com/...
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
    // Si es una URL firmada, no debemos modificar transformaciones o se invalida la firma.
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

    // Si ya hay transformaciones de formato/calidad, respetarlas.
    if (hasFormatTransform || hasQualityTransform) {
        return rawUrl;
    }

    // Solo optimizamos URLs crudas sin transformaciones explícitas.
    return `${prefix}f_auto,q_auto/${suffix}`;
}

export function getFullImageUrl(url?: string | null): string | undefined {
    if (!url) return undefined;

    let trimmed = sanitizeRawUrl(url);
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return undefined;

    console.log('[getFullImageUrl] INPUT:', { raw: url, sanitized: trimmed });

    // Soporta URLs absolutas sin esquema para Cloudinary.
    if (/^res\.cloudinary\.com\//i.test(trimmed)) {
        trimmed = `https://${trimmed}`;
    }

    // Soporta hosts sin esquema como 192.168.1.10:3000/uploads/... o dominio.com/...
    if (/^[a-z0-9.-]+(?::\d+)?\//i.test(trimmed) && !trimmed.startsWith('/')) {
        if (/^localhost(?::\d+)?\//i.test(trimmed)) {
            trimmed = `http://${trimmed}`;
        } else {
            trimmed = `https://${trimmed}`;
        }
    }

    const supportedScheme = /^(https?:|file:|content:|ph:|asset-library:|data:)/i;

    if (!supportedScheme.test(trimmed) && !trimmed.startsWith('/')) {
        // Si contiene cloudinary en mitad de cadena, intenta recuperar el tramo válido.
        const cloudinaryIndex = trimmed.toLowerCase().indexOf('res.cloudinary.com/');
        if (cloudinaryIndex >= 0) {
            trimmed = `https://${trimmed.slice(cloudinaryIndex)}`;
            const normalizedCloudinary = normalizeAbsoluteUrl(trimmed);
            const result = maybeEncodeUrl(optimizeCloudinaryUrl(normalizedCloudinary));
            console.log('[getFullImageUrl] OUTPUT (cloudinary mid-string):', result);
            return result;
        }

        // Soporta rutas relativas antiguas tipo "uploads/..." o "profile-images/...".
        const normalizedRelative = `/${trimmed.replace(/^\/+/, '')}`;
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
        const result = maybeEncodeUrl(`${apiUrl}${normalizedRelative}`);
        console.log('[getFullImageUrl] OUTPUT (relative path):', result);
        return result;
    }

    // Si ya es una URL absoluta, devolverla tal cual
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const normalizedAbsolute = normalizeAbsoluteUrl(trimmed);
        const result = maybeEncodeUrl(optimizeCloudinaryUrl(normalizedAbsolute));
        console.log('[getFullImageUrl] OUTPUT (absolute):', result);
        return result;
    }

    // Si es una URL relativa, construir la URL completa
    if (trimmed.startsWith('/')) {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
        const result = maybeEncodeUrl(`${apiUrl}${trimmed}`);
        console.log('[getFullImageUrl] OUTPUT (relative slash):', result);
        return result;
    }

    console.log('[getFullImageUrl] OUTPUT (fallback):', trimmed);
    return maybeEncodeUrl(trimmed);
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

    console.log('[getImageUrlCandidates]', { input: url, sanitized: raw, candidates: candidates.slice(0, 3) });

    return candidates;
}
