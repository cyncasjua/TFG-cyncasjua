import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsService } from '../events/events.service';
import { UsersService } from '../users/users.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { TipoEnum } from '../enums/tipo.enum';
// import { Event } from '../events/event.entity';
// import { User } from '../users/user.entity';

const RADIO_KM = 1;

function calcularDistanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;

}

@Injectable()
export class NotificacionesScheduler {
  private readonly logger = new Logger(NotificacionesScheduler.name);

  constructor(
    private readonly eventsService: EventsService,
    private readonly usersService: UsersService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async notificarEventosCercanos() {
    this.logger.log('Ejecutando notificación de eventos cercanos...');
    const eventos = await this.eventsService.findAll();
    const usuarios = await this.usersService.findAll();

    for (const evento of eventos) {
      if (!evento.location || !evento.location.coordinates) continue;
      const [lonEv, latEv] = evento.location.coordinates;
      for (const usuario of usuarios) {
        if (!usuario.ubicacion || !usuario.ubicacion.coordinates) continue;
        const [lonU, latU] = usuario.ubicacion.coordinates;
        const distancia = calcularDistanciaKm(latEv, lonEv, latU, lonU);
        if (distancia <= RADIO_KM) {
          const notificaciones = await this.notificacionesService.obtenerParaUsuario(usuario.id);
          const yaNotificado = notificaciones.some(n => n.mensaje.includes(evento.title));
          if (!yaNotificado) {
            await this.notificacionesService.crearParaUsuario(
              usuario,
              `Nuevo evento cerca de ti: "${evento.title}"`,
              TipoEnum.EventoCercano
            );
          }
        }
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async notificarEventosProximos() {
    this.logger.log('Ejecutando notificación de eventos próximos (24h)...');
    const ahora = new Date();
    const dentro24h = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
    const eventos = await this.eventsService.findAll();
    for (const evento of eventos) {
      if (!evento.fechaInicio || !evento.asistentes || evento.asistentes.length === 0) continue;
      const fechaEvento = new Date(evento.fechaInicio);
      if (fechaEvento > ahora && fechaEvento <= dentro24h) {
        for (const usuario of evento.asistentes) {
          const notificaciones = await this.notificacionesService.obtenerParaUsuario(usuario.id);
          const yaNotificado = notificaciones.some(n => n.tipo === TipoEnum.EventoProximo && n.mensaje.includes(evento.title));
          if (!yaNotificado) {
            await this.notificacionesService.crearParaUsuario(
              usuario,
              `Recuerda: el evento "${evento.title}" al que te apuntaste es mañana (${fechaEvento.toLocaleString()})`,
              TipoEnum.EventoProximo
            );
          }
        }
      }
    }
    this.logger.log('Notificación de eventos próximos completada.');
  }

}
