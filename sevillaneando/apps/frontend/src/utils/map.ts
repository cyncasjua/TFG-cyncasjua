import type { Event } from '../types/event';

export const SEVILLE_COORDINATES = { latitude: 37.3891, longitude: -5.9845 };
export const OSM_TILE_URL_TEMPLATE = 'http://c.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const haversineDistanceKm = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number => {
  const earthRadiusKm = 6371;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

export const parseEventPoint = (event: Event): { latitude: number; longitude: number } | null => {
  if (event.latitude !== undefined && event.longitude !== undefined) {
    return { latitude: event.latitude, longitude: event.longitude };
  }

  if (!event.location) {
    return null;
  }

  if (
    typeof event.location === 'object' &&
    event.location.type === 'Point' &&
    Array.isArray(event.location.coordinates) &&
    event.location.coordinates.length === 2
  ) {
    return { latitude: event.location.coordinates[1], longitude: event.location.coordinates[0] };
  }

  return null;
};

/**
 * Parse location data in multiple formats (object, POINT string)
 * Returns { latitude, longitude } or null if parsing fails
 */
export const parseLocationPoint = (
  location?: string | any,
): { latitude: number; longitude: number } | null => {
  if (!location) return null;

  if (typeof location === 'object' && location.coordinates) {
    const [lon, lat] = location.coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { latitude: lat, longitude: lon };
    }
  }

  if (typeof location === 'string') {
    // Accepts "SRID=4326;POINT(lon lat)" or "POINT(lon lat)"
    const match = location.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
    if (!match) return null;
    const lon = parseFloat(match[1]);
    const lat = parseFloat(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { latitude: lat, longitude: lon };
  }

  return null;
};
