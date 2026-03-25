import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Event } from './event.entity';
import { User } from '../users/user.entity';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { UsersModule } from '../users/users.module';
import { Mensaje } from '../entities/mensaje.entity';
import { Resena } from '../entities/resena.entity';
import { EventEditRequest } from './event-edit-request.entity';
import { EventEditRequestService } from './event-edit-request.service';
import { EventEditRequestController } from './event-edit-request.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, User, Mensaje, Resena,  EventEditRequest]),
    AuthModule,
    NotificacionesModule,
    UsersModule,
  ],
  controllers: [EventsController, EventEditRequestController],
  providers: [EventsService, EventEditRequestService],
  exports: [EventsService],
})
export class EventsModule { }
