import { api, getErrorMessage } from './api';
import type { Event } from '../types/event';
import { PublicUser } from '../types/user';
import { parseLocationPoint } from '../utils/map';

function mapEventFromRaw(event: any): Event & { distanceKm?: number } {
  const coords = parseLocationPoint(event.location);
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
    distanceKm: event.distanceKm != null ? Number(event.distanceKm) : undefined,
  };
}

export async function getEvents(
  userId?: string,
  params?: { lat?: number; lng?: number; radiusKm?: number; limit?: number; offset?: number }
): Promise<{ events: (Event & { distanceKm?: number })[]; hasMore: boolean }> {
  const queryParams = { ...(userId ? { userId } : {}), ...params };
  const res = await api.get('/events', { params: queryParams });
  const data = res.data as { events: any[]; hasMore: boolean };
  return {
    events: data.events.map(mapEventFromRaw),
    hasMore: data.hasMore,
  };
}

export async function getEventById(eventId: string): Promise<Event> {
  const res = await api.get(`/events/${eventId}`);
  const event = res.data as any;
  const coords = parseLocationPoint(event.location);
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

export async function getEventByAccessLink(linkAcceso: string): Promise<Event> {
  const res = await api.get(`/events/acceso/${linkAcceso}`);
  const event = res.data as any;
  const coords = parseLocationPoint(event.location);
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
