import type { User } from './user';
import type { Event } from './event';

export interface Recommendation {
  id: string;
  usuario: User;
  evento: Event;
  razon: string;
  puntuacion: number;
  fechaCreacion: string;
}
