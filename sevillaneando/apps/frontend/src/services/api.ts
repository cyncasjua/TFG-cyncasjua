import axios, { AxiosError } from 'axios';
import type { Event } from '../types/event';
import { PublicUser } from '../types/user';

const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL,
  timeout: 10000,
});


export function getErrorMessage(error: unknown): string {
  if (!error) return 'Error desconocido';

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;

    if (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string') {
      return axiosError.response.data.message;
    }

    if (Array.isArray(axiosError.response?.data?.message)) {
      const messages = axiosError.response.data.message as string[];
      return messages.join('. ');
    }

    if (axiosError.response?.data?.error && typeof axiosError.response.data.error === 'string') {
      return axiosError.response.data.error;
    }

    if (axiosError.response?.status === 400) {
      const details = axiosError.response?.data?.message || 'Solicitud inválida';
      if (Array.isArray(details)) {
        return details.join('. ');
      }
      return String(details);
    }

    if (axiosError.response?.status === 401) {
      return 'No autorizado. Por favor, inicia sesión nuevamente.';
    }

    if (axiosError.response?.status === 403) {
      return 'Acceso denegado. No tienes permisos.';
    }

    if (axiosError.response?.status === 404) {
      return 'Recurso no encontrado.';
    }

    if (axiosError.response?.status === 500) {
      return 'Error del servidor. Intenta más tarde.';
    }

    if (axiosError.code === 'ECONNABORTED') {
      return 'La solicitud tardó demasiado. Verifica tu conexión.';
    }

    if (axiosError.message) {
      return axiosError.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function setAuthToken(token: string) {
  if (!token) {
    delete api.defaults.headers.common.Authorization;
  } else {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
}

function parsePoint(location?: string | any) {
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
}

export async function getEvents(userId?: string): Promise<Event[]> {
  const res = await api.get('/events', userId ? { params: { userId } } : undefined);
  return (res.data as any[]).map((event) => {
    const coords = parsePoint(event.location);
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      address: event.address,
      location: event.location,
      fechaInicio: event.fechaInicio ?? null,
      fechaFin: event.fechaFin ?? null,
      hasMultipleDatesAvailable: event.hasMultipleDatesAvailable ?? false,
      precio: event.precio,
      precioMin: event.precioMin,
      precioMax: event.precioMax,
      categoria: event.categoria,
      estado: event.estado,
      creador: event.creador,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      imagen: event.imagen,
      imagenes: event.imagenes,
      privado: event.privado,
      linkAcceso: event.linkAcceso,
      ratingAverage: event.ratingAverage,
      ratingsCount: event.ratingsCount,
    } as Event;
  });
}

export async function getEventById(eventId: string): Promise<Event> {
  const res = await api.get(`/events/${eventId}`);
  const event = res.data as any;
  const coords = parsePoint(event.location);
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    address: event.address,
    location: event.location,
    fechaInicio: event.fechaInicio,
    fechaFin: event.fechaFin,
    hasMultipleDatesAvailable: event.hasMultipleDatesAvailable ?? false,
    precio: event.precio,
    precioMin: event.precioMin,
    precioMax: event.precioMax,
    categoria: event.categoria,
    estado: event.estado,
    creador: event.creador,
    latitude: coords?.latitude,
    longitude: coords?.longitude,
    imagen: event.imagen,
    imagenes: event.imagenes,
    privado: event.privado,
    linkAcceso: event.linkAcceso,
    ratingAverage: event.ratingAverage,
    ratingsCount: event.ratingsCount,
  } as Event;
}

export async function getEventAttendees(eventId: string): Promise<PublicUser[]> {
  const res = await api.get(`/events/${eventId}/attendees`);
  return res.data as PublicUser[];
}

export async function getMyAttendance(eventId: string): Promise<{ attending: boolean }> {
  const res = await api.get(`/events/${eventId}/attendees/me`);
  return res.data as { attending: boolean };
}

export interface EventReview {
  id: string;
  puntuacion: number;
  comentario: string;
  fecha: string;
  autor?: {
    id: string;
    nombre: string;
    fotoPerfil?: string;
  };
}

export async function getEventReviews(eventId: string): Promise<EventReview[]> {
  const res = await api.get(`/events/${eventId}/reviews`);
  return res.data as EventReview[];
}

export async function attendEvent(eventId: string): Promise<PublicUser[]> {
  const res = await api.post(`/events/${eventId}/attendees`);
  return res.data as PublicUser[];
}

export async function unattendEvent(eventId: string): Promise<PublicUser[]> {
  const res = await api.delete(`/events/${eventId}/attendees`);
  return res.data as PublicUser[];
}

export async function getUserProfile(userId: string): Promise<PublicUser | null> {
  const res = await api.get(`/users/${userId}`);
  return res.data as PublicUser | null;
}

export async function getEventByAccessLink(linkAcceso: string): Promise<Event> {
  const res = await api.get(`/events/acceso/${linkAcceso}`);
  const event = res.data as any;
  const coords = parsePoint(event.location);
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    address: event.address,
    location: event.location,
    fechaInicio: event.fechaInicio,
    fechaFin: event.fechaFin,
    hasMultipleDatesAvailable: event.hasMultipleDatesAvailable ?? false,
    precio: event.precio,
    precioMin: event.precioMin,
    precioMax: event.precioMax,
    categoria: event.categoria,
    estado: event.estado,
    creador: event.creador,
    latitude: coords?.latitude,
    longitude: coords?.longitude,
    imagen: event.imagen,
    imagenes: event.imagenes,
    privado: event.privado,
    linkAcceso: event.linkAcceso,
    ratingAverage: event.ratingAverage,
    ratingsCount: event.ratingsCount,
  } as Event;
}

export async function getPrivateEventShareLink(eventId: string): Promise<{ linkAcceso: string }> {
  const res = await api.get(`/events/${eventId}/private-share-link`);
  return res.data as { linkAcceso: string };
}

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

// Rutas personalizadas
export type UserRoute = {
  id: string;
  titulo: string;
  descripcion?: string;
  trayecto: Array<{ type: 'Point'; coordinates: [number, number] }>;
  secuenciaEventos: RecommendedEvent[];
  temporizacion: number;
  creador: {
    id: string;
    nombre: string;
    fotoPerfil?: string | null;
  };
  fechaCreacion: string;
  puntuacionPromedio: number;
  numCalificaciones: number;
};

export async function createRoute(payload: {
  titulo: string;
  descripcion?: string;
  trayecto: Array<{ type: 'Point'; coordinates: [number, number] }>;
  eventosIds: string[];
  temporizacion: number;
}): Promise<UserRoute> {
  const res = await api.post('/rutas', payload);
  return res.data as UserRoute;
}

export async function getRoutes(userId?: string): Promise<UserRoute[]> {
  const params = userId ? { userId } : undefined;
  const res = await api.get('/rutas', { params });
  return res.data as UserRoute[];
}

export async function getRouteById(id: string): Promise<UserRoute> {
  const res = await api.get(`/rutas/${id}`);
  return res.data as UserRoute;
}

export async function updateRoute(
  id: string,
  payload: {
    titulo?: string;
    descripcion?: string;
    trayecto?: Array<{ type: 'Point'; coordinates: [number, number] }>;
    eventosIds?: string[];
    temporizacion?: number;
  },
): Promise<UserRoute> {
  const res = await api.patch(`/rutas/${id}`, payload);
  return res.data as UserRoute;
}

export async function deleteRoute(id: string): Promise<void> {
  await api.delete(`/rutas/${id}`);
}

export async function rateRoute(id: string, puntuacion: number): Promise<UserRoute> {
  const res = await api.post(`/rutas/${id}/calificar`, { puntuacion });
  return res.data as UserRoute;
}

export async function searchRoutes(query: string): Promise<UserRoute[]> {
  const res = await api.get('/rutas/search', { params: { q: query } });
  return res.data as UserRoute[];
}
