import type { User } from './user';
import type { Event } from './event';

export interface Message {
  id: string;
  contenido: string;
  imageUrl?: string | null;
  usuario: User;
  evento: Event;
  fechaCreacion: string;
}

export interface PrivateMessage {
  id: string;
  contenido: string;
  imageUrl?: string | null;
  emisor: User;
  receptor: User;
  fechaCreacion: string;
  leido: boolean;
}
