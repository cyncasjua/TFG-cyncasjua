import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ScrapingScheduler } from './scraping.scheduler';
import { NotificacionesScheduler } from './notificaciones.scheduler';

@Controller('scheduler')
export class SchedulerController {
  constructor(
    private readonly scrapingScheduler: ScrapingScheduler,
    private readonly notificacionesScheduler: NotificacionesScheduler
  ) {}

  @Post('run-scraping')
  @HttpCode(HttpStatus.OK)
  async runScraping() {
    await this.scrapingScheduler.handleDailyScraping();
    return { status: 'ok', job: 'scraping' };
  }

  @Post('run-notifications')
  @HttpCode(HttpStatus.OK)
  async runNotifications() {
    await Promise.all([
      this.notificacionesScheduler.notificarEventosCercanos(),
      this.notificacionesScheduler.notificarEventosProximos(),
      this.notificacionesScheduler.notificarEventosMenos24h(),
    ]);
    return { status: 'ok', job: 'notifications' };
  }
}
