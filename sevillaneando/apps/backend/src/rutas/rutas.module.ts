import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RutasService } from './rutas.service';
import { RutasController } from './rutas.controller';
import { Ruta } from '../entities/ruta.entity';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';
import { CalificacionRuta } from '../entities/calificacion-ruta.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ruta, Event, User, CalificacionRuta]),
    AuthModule,
    UsersModule,
  ],
  controllers: [RutasController],
  providers: [RutasService],
  exports: [RutasService],
})
export class RutasModule {}
