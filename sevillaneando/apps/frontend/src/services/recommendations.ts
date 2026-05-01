import { api } from './api';

export type RecommendedEvent = {
  id: string;
  title: string;
  description: string;
  fechaInicio: string | null;
  fechaFin: string | null;
  hasMultipleDatesAvailable?: boolean;
  address: string;
  categoria: string | null;
  imagen: string | null;
  score: number;
  distanceKm: number | null;
  reasons: string[];
};

export type RecommendedRoute = {
  day: string;
  scoreMedio: number;
  temporizacionMinutos: number;
  distanceTotalKm: number;
  quality?: number;
  eventos: RecommendedEvent[];
  trayecto: Array<{ type: 'Point'; coordinates: [number, number] }>;
};

export async function saveRecommendedEvent(eventId: string): Promise<{ ok: boolean }> {
  const res = await api.post(`/recomendaciones/events/${eventId}/guardar`);
  return res.data as { ok: boolean };
}

export async function unsaveRecommendedEvent(eventId: string): Promise<{ ok: boolean }> {
  const res = await api.delete(`/recomendaciones/events/${eventId}/guardar`);
  return res.data as { ok: boolean };
}

export async function getSavedRecommendedEvents(): Promise<{ total: number; eventos: RecommendedEvent[] }> {
  const res = await api.get('/recomendaciones/me/guardados');
  return res.data as { total: number; eventos: RecommendedEvent[] };
}

export async function shareRecommendedEvent(eventId: string): Promise<{ ok: boolean }> {
  const res = await api.post(`/recomendaciones/events/${eventId}/compartir`);
  return res.data as { ok: boolean };
}

export async function visitRecommendedEvent(eventId: string): Promise<{ ok: boolean }> {
  const res = await api.post(`/recomendaciones/events/${eventId}/visitar`);
  return res.data as { ok: boolean };
}

export async function rateRecommendedEvent(
  eventId: string,
  payload: { puntuacion: number; comentario?: string },
): Promise<{ ok: boolean; action: string; resenaId: string }> {
  const res = await api.post(`/recomendaciones/events/${eventId}/valorar`, payload);
  return res.data as { ok: boolean; action: string; resenaId: string };
}

export async function getMyRecommendedEventRating(
  eventId: string,
): Promise<{ hasRating: boolean; puntuacion: number | null; comentario: string; fecha: string | null }> {
  const res = await api.get(`/recomendaciones/events/${eventId}/valorar/me`);
  return res.data as {
    hasRating: boolean;
    puntuacion: number | null;
    comentario: string;
    fecha: string | null;
  };
}

export async function getRecommendedEvents(params?: {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<{ total: number; criterios: string[]; eventos: RecommendedEvent[] }> {
  const res = await api.get('/recomendaciones/me/events', { params });
  return res.data as { total: number; criterios: string[]; eventos: RecommendedEvent[] };
}

export async function getRecommendedRoutes(params?: {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  from?: string;
  to?: string;
  limit?: number;
  routesLimit?: number;
  minEventsPerRoute?: number;
  maxEventsPerRoute?: number;
  strategy?: 'balanced' | 'walkable' | 'score';
  maxGapMinutes?: number;
  maxOverlapMinutes?: number;
}): Promise<{ total: number; rutas: RecommendedRoute[] }> {
  const res = await api.get('/recomendaciones/me/rutas', { params });
  return res.data as { total: number; rutas: RecommendedRoute[] };
}
