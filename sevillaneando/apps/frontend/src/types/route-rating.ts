import type { User } from './user';
import type { Route } from './route';

export interface RouteRating {
  id: string;
  usuario: User;
  ruta: Route;
  puntuacion: number; // 1-5
  comentario?: string;
  fecha: string;
}
