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

export async function getEvents(): Promise<Event[]> {
  const res = await api.get('/events');
  return (res.data as any[]).map((event) => {
    const coords = parsePoint(event.location);
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      address: event.address,
      location: event.location,
      fechaInicio: event.fechaInicio,
      fechaFin: event.fechaFin,
      precio: event.precio,
      categoria: event.categoria,
      estado: event.estado,
      creador: event.creador,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      imagen: event.imagen,
    } as Event;
  });
}

export async function getEventAttendees(eventId: string): Promise<PublicUser[]> {
  const res = await api.get(`/events/${eventId}/attendees`);
  return res.data as PublicUser[];
}

export async function getMyAttendance(eventId: string): Promise<{ attending: boolean }> {
  const res = await api.get(`/events/${eventId}/attendees/me`);
  return res.data as { attending: boolean };
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
