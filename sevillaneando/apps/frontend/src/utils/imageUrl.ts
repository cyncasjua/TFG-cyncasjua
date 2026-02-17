/**
 * Convierte una URL de imagen (relativa o absoluta) a una URL completa
 * @param url - URL de la imagen (relativa como "/uploads/..." o absoluta)
 * @returns URL completa de la imagen
 */
export function getFullImageUrl(url?: string | null): string | undefined {
    if (!url) return undefined;

    // Si ya es una URL absoluta, devolverla tal cual
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }

    // Si es una URL relativa, construir la URL completa
    if (url.startsWith('/')) {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
        return `${apiUrl}${url}`;
    }

    return url;
}
