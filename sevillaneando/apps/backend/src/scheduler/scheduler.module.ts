import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScrapingScheduler } from './scraping.scheduler';
import { NotificacionesScheduler } from './notificaciones.scheduler';
import { PurgaDatosScheduler } from './purga-datos.scheduler';
import { SchedulerController } from './scheduler.controller';
import { ScrapingModule } from '../scraping/scraping.module';
import { EventsModule } from '../events/events.module';
import { UsersModule } from '../users/users.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { MensajePrivado } from '../chat/mensaje-privado.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([MensajePrivado]),
    ScrapingModule,
    EventsModule,
    UsersModule,
    NotificacionesModule,
  ],
  controllers: [SchedulerController],
  providers: [ScrapingScheduler, NotificacionesScheduler, PurgaDatosScheduler],
})
export class SchedulerModule {}
