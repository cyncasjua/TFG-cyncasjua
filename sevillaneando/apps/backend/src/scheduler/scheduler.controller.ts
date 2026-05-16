import { Controller, Get, Post, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ScrapingScheduler } from './scraping.scheduler';
import { NotificacionesScheduler } from './notificaciones.scheduler';
import { PurgaDatosScheduler } from './purga-datos.scheduler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Scheduler')
@Controller('scheduler')
export class SchedulerController {
  private readonly logger = new Logger(SchedulerController.name);

  constructor(
    private readonly scrapingScheduler: ScrapingScheduler,
    private readonly notificacionesScheduler: NotificacionesScheduler,
    private readonly purgaDatosScheduler: PurgaDatosScheduler
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check del scheduler' })
  @ApiResponse({
    status: 200,
    description: 'Estado del scheduler',
    schema: { example: { status: 'ok' } },
  })
  health() {
    return { status: 'ok' };
  }

  @Post('run-scraping')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lanzar el scraping manualmente (trigger HTTP para Cloud Scheduler)' })
  @ApiResponse({
    status: 200,
    description: 'Scraping lanzado',
    schema: { example: { status: 'ok', job: 'scraping' } },
  })
  runScraping() {
    this.scrapingScheduler
      .handleDailyScraping()
      .catch((err: unknown) => this.logger.error('Error en scraping programado:', err));
    return { status: 'ok', job: 'scraping' };
  }

  @Post('run-notifications')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lanzar el envío de notificaciones manualmente (trigger HTTP para Cloud Scheduler)',
  })
  @ApiResponse({
    status: 200,
    description: 'Notificaciones lanzadas',
    schema: { example: { status: 'ok', job: 'notifications' } },
  })
  runNotifications() {
    Promise.all([
      this.notificacionesScheduler.notificarEventosCercanos(),
      this.notificacionesScheduler.notificarEventosProximos(),
      this.notificacionesScheduler.notificarEventosMenos24h(),
    ]).catch((err: unknown) => this.logger.error('Error en notificaciones programadas:', err));
    return { status: 'ok', job: 'notifications' };
  }

  @Post('run-purga-datos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Purgar datos huérfanos RGPD (trigger HTTP para Cloud Scheduler o uso manual)',
  })
  @ApiResponse({
    status: 200,
    description: 'Purga lanzada',
    schema: { example: { status: 'ok', job: 'purga-datos' } },
  })
  runPurgaDatos() {
    this.purgaDatosScheduler
      .purgarMensajesHuerfanos()
      .catch((err: unknown) => this.logger.error('Error en purga de datos programada:', err));
    return { status: 'ok', job: 'purga-datos' };
  }
}
