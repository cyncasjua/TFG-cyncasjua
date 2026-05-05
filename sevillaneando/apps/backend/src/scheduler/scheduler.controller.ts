import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ScrapingScheduler } from './scraping.scheduler';
import { NotificacionesScheduler } from './notificaciones.scheduler';

@Controller('scheduler')
export class SchedulerController {
  constructor(
    private readonly scrapingScheduler: ScrapingScheduler,
    private readonly notificacionesScheduler: NotificacionesScheduler
  ) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Post('run-scraping')
  @HttpCode(HttpStatus.OK)
  runScraping() {
    this.scrapingScheduler.handleDailyScraping().catch(() => {});
    return { status: 'ok', job: 'scraping' };
  }

  @Post('run-notifications')
  @HttpCode(HttpStatus.OK)
  runNotifications() {
    Promise.all([
      this.notificacionesScheduler.notificarEventosCercanos(),
      this.notificacionesScheduler.notificarEventosProximos(),
      this.notificacionesScheduler.notificarEventosMenos24h(),
    ]).catch(() => {});
    return { status: 'ok', job: 'notifications' };
  }
}
