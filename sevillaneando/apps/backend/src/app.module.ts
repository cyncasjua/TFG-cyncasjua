import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { Event } from './events/event.entity';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';
import { SeedService } from './database/seed.service';
import { Categoria } from './categorias/categoria.entity';
import { Resena } from './events/resena.entity';
import { Ruta } from './rutas/ruta.entity';
import { CalificacionRuta } from './rutas/calificacion-ruta.entity';
import { Notificacion } from './notificaciones/notificacion.entity';
import { Recomendacion } from './recomendaciones/recomendacion.entity';
import { CategoriasModule } from './categorias/categorias.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { Mensaje } from './chat/mensaje.entity';
import { ChatModule } from './chat/chat.module';
import { MensajePrivado } from './chat/mensaje-privado.entity';
import { ScrapingModule } from './scraping/scraping.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { EventEditRequest } from './events/event-edit-request.entity';
import { RecomendacionesModule } from './recomendaciones/recomendaciones.module';
import { RutasModule } from './rutas/rutas.module';
import { CloudinaryModule } from './common/cloudinary/cloudinary.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CloudinaryModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: parseInt(config.get('DATABASE_PORT', '5432'), 10),
        username: config.get('DATABASE_USER', 'postgres'),
        password: config.get('DATABASE_PASSWORD', 'postgres'),
        database: config.get('DATABASE_NAME', 'sevillaneando'),
        entities: [
          Event,
          User,
          Categoria,
          Resena,
          Ruta,
          CalificacionRuta,
          Notificacion,
          Recomendacion,
          Mensaje,
          MensajePrivado,
          EventEditRequest
        ],
        synchronize: process.env.NODE_ENV !== 'production',
      }),
    }),
    DatabaseModule,
    EventsModule,
    UsersModule,
    AuthModule,
    CategoriasModule,
    NotificacionesModule,
    ChatModule,
    ScrapingModule,
    SchedulerModule,
    RecomendacionesModule,
    RutasModule,
  ],
})
export class AppModule {
  constructor(private readonly seedService: SeedService) {
    this.seedService.seed().catch(console.error);
  }
}
