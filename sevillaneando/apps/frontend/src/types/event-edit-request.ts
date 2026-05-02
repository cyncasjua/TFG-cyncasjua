import type { Event } from './event';
import type { User } from './user';

export interface EventEditRequest {
  id: string;
  evento: Event;
  solicitante: User;
  cambiosPropuestos: Partial<Event>;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  fechaCreacion: string;
  razonRechazo?: string;
}
