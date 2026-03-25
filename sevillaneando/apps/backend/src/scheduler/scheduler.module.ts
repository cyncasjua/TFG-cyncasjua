import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScrapingScheduler } from './scraping.scheduler';
import { NotificacionesScheduler } from './notificaciones.scheduler';
import { ScrapingModule } from '../scraping/scraping.module';
import { EventsModule } from '../events/events.module';
import { UsersModule } from '../users/users.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ScrapingModule,
    EventsModule,
    UsersModule,
    NotificacionesModule,
  ],
  providers: [ScrapingScheduler, NotificacionesScheduler],
})
export class SchedulerModule {}
