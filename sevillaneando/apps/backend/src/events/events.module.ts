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
import { Imagen } from '../entities/imagen.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, User, Mensaje, Resena, Imagen]),
    AuthModule,
    NotificacionesModule,
    UsersModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule { }
