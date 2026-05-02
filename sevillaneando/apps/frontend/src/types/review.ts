import type { User } from './user';
import type { Event } from './event';

export interface Review {
  id: string;
  autor: User;
  evento: Event;
  comentario: string;
  puntuacion: number; // 1-5
  fecha: string;
}
