import type { Event } from './event';
import type { User } from './user';
import type { GeoJsonPoint } from './geojson';

export interface Route {
  id: string;
  titulo: string;
  descripcion?: string;
  trayecto: GeoJsonPoint[];
  secuenciaEventos: Event[];
  temporizacion: number;
  creador: User;
  fechaCreacion: string;
  puntuacionPromedio: number;
  numCalificaciones: number;
}
