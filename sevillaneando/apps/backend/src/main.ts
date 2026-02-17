import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { Event } from './events/event.entity';
import { seedEvents } from './database/seed';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Server, Socket } from 'socket.io';
import { Mensaje } from './entities/mensaje.entity';
import { FirebaseService } from './auth/firebase.service';
import { User } from './users/user.entity';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { cors: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      skipMissingProperties: false,
      stopAtFirstError: false,
    })
  );

  const server = app.getHttpServer();
  const io = new Server(server, {
    cors: {
      origin: '*',
    },
  });

  function emitSocketError(socket: Socket, code: string, message: string) {
    socket.emit('chat_error', { code, message });
  }
  const firebaseService = app.get(FirebaseService);
  const dataSource = app.get(DataSource);

  const usersRepo = dataSource.getRepository(User);
  const eventsRepo = dataSource.getRepository(Event);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('auth_missing'));
      const decoded = await firebaseService.verifyToken(token);
      if (!decoded) return next(new Error('auth_invalid'));
      socket.data.user = decoded;
      return next();
    } catch {
      return next(new Error('auth_failed'));
    }
  });

  const chatRepo = dataSource.getRepository(Mensaje);

  io.on('connection', (socket) => {
    //console.log('User connected:', socket.id);

    socket.on('disconnect', () => {
      //console.log('User disconnected:', socket.id);
    });

    socket.on('join_room', async (eventId: string) => {
      try {
        if (!eventId) {
          emitSocketError(socket, 'event_missing', 'Falta el id del evento');
          return;
        }

        const event = await dataSource.getRepository(Event).findOne({
          where: { id: eventId },
        });
        if (!event) {
          emitSocketError(socket, 'event_not_found', 'Evento no encontrado');
          return;
        }

        const room = `event:${eventId}`;
        socket.join(room);

        //carga los últimos 50 mensajes del evento por si hay error
        const history = await chatRepo.find({
          where: { evento: { id: eventId } },
          relations: ['usuario'],
          order: { fechaCreacion: 'ASC' },
          take: 50,
        });

        //envia el evento solo al socket actual (el cliente que hizo la llamada).
        socket.emit('chat_history', history);
      } catch {
        emitSocketError(socket, 'history_failed', 'Error al cargar el historial');
      }
    });

    socket.on(
      'chat_message',
      async ({ eventId, text, imageUrl }: { eventId: string; text?: string; imageUrl?: string }) => {
        try {
          const firebaseUid = socket.data.user?.uid;
          const trimmedText = text?.trim() ?? '';
          const trimmedImageUrl = imageUrl?.trim() ?? '';
          const hasText = trimmedText.length > 0;
          const hasImage = trimmedImageUrl.length > 0;
          if (!firebaseUid || !eventId || (!hasText && !hasImage)) return;

          const user = await usersRepo.findOne({ where: { firebaseUid } });
          if (!user) {
            socket.emit('chat_error', { message: 'Usuario no encontrado' });
            return;
          }

          const event = await eventsRepo.findOne({ where: { id: eventId } });
          if (!event) {
            socket.emit('chat_error', { message: 'Evento no encontrado' });
            return;
          }

          const message = chatRepo.create({
            contenido: hasText ? trimmedText : '',
            imageUrl: hasImage ? trimmedImageUrl : null,
            evento: event,
            usuario: user,
          });

          const saved = await chatRepo.save(message);
          //emite el evento a todos los sockets conectados a ese room, incluido el emisor si esta en el room.
          io.to(`event:${eventId}`).emit('chat_message', saved);
        } catch (err) {
          console.error(err);
          socket.emit('chat_error', { message: 'Error al guardar mensaje' });
        }
      }
    );
  });



  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  const eventRepo = dataSource.getRepository(Event);
  await seedEvents(eventRepo, dataSource);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API escuchando en http://localhost:${port}`);
}

bootstrap();
