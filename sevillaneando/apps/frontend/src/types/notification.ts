export enum NotificationType {
  EventoCercano = 'eventoCercano',
  EventoProximo = 'eventoProximo',
  ResenaNueva = 'resenaNueva',
  RecomendacionNueva = 'recomendacionNueva',
}

export interface Notification {
  id: string;
  usuarioId: string;
  tipo: NotificationType;
  mensaje: string;
  leido: boolean;
  fechaCreacion: string;
  eventoId?: string;
  targetUserId?: string | null;
  targetEventId?: string | null;
}
