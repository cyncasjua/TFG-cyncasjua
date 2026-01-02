import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { Event } from './events/event.entity';
import { seedEvents } from './database/seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  
  // Ejecutar seed
  const dataSource = app.get(DataSource);
  const eventRepo = dataSource.getRepository(Event);
  await seedEvents(eventRepo, dataSource);
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API escuchando en http://localhost:${port}`);
}

bootstrap();
