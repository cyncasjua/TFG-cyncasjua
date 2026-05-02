import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecomendacionesController } from './recomendaciones.controller';
import { RecomendacionesService } from './recomendaciones.service';
import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';
import { Resena } from '../events/resena.entity';
import { Recomendacion } from './recomendacion.entity';
import { Ruta } from '../rutas/ruta.entity';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Event, Resena, Recomendacion, Ruta]), UsersModule, AuthModule],
  controllers: [RecomendacionesController],
  providers: [RecomendacionesService],
  exports: [RecomendacionesService],
})
export class RecomendacionesModule {}
