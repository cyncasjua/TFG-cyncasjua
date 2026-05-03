import { api } from './api';
import type { RecommendedEvent } from './recommendations';

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
  }
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
