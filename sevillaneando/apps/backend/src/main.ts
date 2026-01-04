import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { Event } from './events/event.entity';
import { seedEvents } from './database/seed';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as admin from 'firebase-admin';

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey,
  }),
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true });
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true  
  }));
  
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  
  // Ejecutar seed
  const dataSource = app.get(DataSource);
  const eventRepo = dataSource.getRepository(Event);
  await seedEvents(eventRepo, dataSource);
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API escuchando en http://localhost:${port}`);
}

bootstrap();