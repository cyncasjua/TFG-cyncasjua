import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ScrapingScheduler } from './scraping.scheduler';
import { NotificacionesScheduler } from './notificaciones.scheduler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Scheduler')
@Controller('scheduler')
export class SchedulerController {
  constructor(
    private readonly scrapingScheduler: ScrapingScheduler,
    private readonly notificacionesScheduler: NotificacionesScheduler
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
    this.scrapingScheduler.handleDailyScraping().catch(() => {});
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
    ]).catch(() => {});
    return { status: 'ok', job: 'notifications' };
  }
}
