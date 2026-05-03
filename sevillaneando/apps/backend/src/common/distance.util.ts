export const EARTH_RADIUS_KM = 6371;

export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Calcula la distancia en km entre dos puntos usando la fórmula de Haversine
 * @param lat1 Latitud del primer punto
 * @param lon1 Longitud del primer punto
 * @param lat2 Latitud del segundo punto
 * @param lon2 Longitud del segundo punto
 * @returns Distancia en kilómetros
 */
export const haversineDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

/**
 * Calcula la distancia entre dos puntos en formato [lng, lat]
 */
export const haversineDistanceFromCoordinates = (
  [lon1, lat1]: [number, number],
  [lon2, lat2]: [number, number]
): number => haversineDistanceKm(lat1, lon1, lat2, lon2);
