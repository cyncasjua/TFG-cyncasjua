
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsService } from '../events/events.service';
import { UsersService } from '../users/users.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { TipoEnum } from '../enums/tipo.enum';
import { haversineDistanceKm } from '../common/distance.util';

const RADIO_KM = 1;


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
    const eventos = await this.eventsService.findAllForScheduler();
    const usuarios = await this.usersService.findAll();

    for (const evento of eventos) {
      if (!evento.location || !evento.location.coordinates || !evento.title) continue;
      const [lonEv, latEv] = evento.location.coordinates;
      for (const usuario of usuarios) {
        if (!usuario.ubicacion || !usuario.ubicacion.coordinates) continue;
        const [lonU, latU] = usuario.ubicacion.coordinates;
        const distancia = haversineDistanceKm(Number(latEv), Number(lonEv), Number(latU), Number(lonU));
        if (distancia <= RADIO_KM) {
          const notificaciones = await this.notificacionesService.obtenerParaUsuario(usuario.id);
          const yaNotificado = notificaciones.some(n => n.mensaje.includes(evento.title!));
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
  this.logger.log('Ejecutando notificación de eventos próximos...');

  const ahora = new Date();
  const dentroUnaSemana = new Date();
  dentroUnaSemana.setDate(ahora.getDate() + 7);

  const eventos = await this.eventsService.findAllForScheduler();

  for (const evento of eventos) {
    if (!evento.fechaInicio || !evento.asistentes || evento.asistentes.length === 0 || !evento.title) continue;

    const fechaEvento = new Date(evento.fechaInicio);

    if (fechaEvento.getTime() > ahora.getTime() && fechaEvento.getTime() <= dentroUnaSemana.getTime()) {

      for (const usuario of evento.asistentes) {
        const notificaciones = await this.notificacionesService.obtenerParaUsuario(usuario.id);

        const yaNotificado = notificaciones.some(n =>
          n.tipo === TipoEnum.EventoProximo &&
          n.mensaje.includes(evento.title!)
        );

        if (!yaNotificado) {

          await this.notificacionesService.crearParaUsuario(
            usuario,
            `Recuerda: el evento "${evento.title}" al que te apuntaste es esta semana (${fechaEvento.toLocaleDateString()})`,
            TipoEnum.EventoProximo
          );
        }
      }
    }
  }
  this.logger.log('Proceso finalizado.');
}

  @Cron(CronExpression.EVERY_HOUR)
  async notificarEventosMenos24h() {
    this.logger.log('Ejecutando notificación de eventos en menos de 24h...');

    const ahora = new Date();
    const en24h = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

    const eventos = await this.eventsService.findAllForScheduler();

    for (const evento of eventos) {
      if (!evento.fechaInicio || !evento.asistentes || evento.asistentes.length === 0 || !evento.title) continue;

      const fechaEvento = new Date(evento.fechaInicio);

      if (fechaEvento.getTime() > ahora.getTime() && fechaEvento.getTime() <= en24h.getTime()) {
        for (const usuario of evento.asistentes) {
          const notificaciones = await this.notificacionesService.obtenerParaUsuario(usuario.id);
          const yaNotificado = notificaciones.some(n =>
            n.tipo === TipoEnum.EventoProximo &&
            n.mensaje.includes(evento.title!) &&
            n.mensaje.includes('mañana')
          );
          if (!yaNotificado) {
              const hora = fechaEvento.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              await this.notificacionesService.crearParaUsuario(
                usuario,
                `Recuerda: el evento "${evento.title}" al que te apuntaste es mañana a las ${hora}`,
                TipoEnum.EventoProximo
              );
          }
        }
      }
    }
    this.logger.log('Notificación de eventos en menos de 24h completada.');
  }
}
