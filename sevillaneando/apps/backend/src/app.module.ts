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
import { Categoria } from './entities/categoria.entity';
import { Imagen } from './entities/imagen.entity';
import { Resena } from './entities/resena.entity';
import { Ruta } from './entities/ruta.entity';
import { Coordenadas } from './entities/coordenadas.entity';
import { Notificacion } from './entities/notificacion.entity';
import { Recomendacion } from './entities/recomendacion.entity';
import { CategoriasModule } from './categorias/categorias.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { Mensaje } from './entities/mensaje.entity';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
          Imagen,
          Resena,
          Ruta,
          Coordenadas,
          Notificacion,
          Recomendacion,
          Mensaje,
        ],
        synchronize: true,
      }),
    }),
    DatabaseModule,
    EventsModule,
    UsersModule,
    AuthModule,
    CategoriasModule,
    NotificacionesModule,
    ChatModule,
  ],
})
export class AppModule {
  constructor(private readonly seedService: SeedService) {
    this.seedService.seed().catch(console.error);
  }
}
