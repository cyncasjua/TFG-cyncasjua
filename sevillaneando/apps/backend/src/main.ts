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
import { MensajePrivado } from './entities/mensaje-privado.entity';

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
  const privateRepo = dataSource.getRepository(MensajePrivado);

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

  io.on('connection', async (socket) => {
    const firebaseUid = socket.data.user?.uid;
    if (firebaseUid) {
      const currentUser = await usersRepo.findOne({ where: { firebaseUid } });
      if (currentUser) {
        socket.data.userId = currentUser.id;
        socket.join(`user:${currentUser.id}`);
      } else {
        console.warn('Usuario no encontrado en DB con firebaseUid:', firebaseUid);
      }
    } else {
      console.warn('Sin firebaseUid en socket.data.user');
    }

    socket.on('disconnect', () => {
    });

    socket.on('get_conversations', async () => {
      try {
        const me = socket.data.userId;
        if (!me) return socket.emit('conversations', []);

        const messages = await privateRepo.find({
          where: [{ emisor: { id: me } }, { receptor: { id: me } }],
          relations: ['emisor', 'receptor'],
          order: { fechaCreacion: 'DESC' },
        });

        const conversationMap = new Map();

        for (const msg of messages) {
          const otherUser = msg.emisor.id === me ? msg.receptor : msg.emisor;
          const otherId = otherUser.id;

          if (!conversationMap.has(otherId)) {
            const unreadCount = await privateRepo.count({
              where: {
                receptor: { id: me },
                emisor: { id: otherId },
                leido: false
              }
            });

            conversationMap.set(otherId, {
              userId: otherId,
              userName: otherUser.nombre,
              userPhoto: otherUser.fotoPerfil,
              lastMessage: msg.contenido,
              lastMessageTime: msg.fechaCreacion,
              unreadCount: unreadCount,
            });
          }
        }

        const conversations = Array.from(conversationMap.values());
        socket.emit('conversations', conversations);
      } catch (err) {
        socket.emit('conversations', []);
      }
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
          const hydrated = await chatRepo.findOne({
            where: { id: saved.id },
            relations: ['usuario'],
          });
          io.to(`event:${eventId}`).emit('chat_message', hydrated ?? saved);
        } catch (err) {
          console.error(err);
          socket.emit('chat_error', { message: 'Error al guardar mensaje' });
        }
      }
    );

    socket.on('dm_history', async ({ withUserId }: { withUserId: string }) => {
      try {
        const me = socket.data.userId;
        if (!me || !withUserId) return;

        const history = await privateRepo.find({
          where: [
            { emisor: { id: me }, receptor: { id: withUserId } },
            { emisor: { id: withUserId }, receptor: { id: me } },
          ],
          relations: ['emisor', 'receptor'],
          order: { fechaCreacion: 'ASC' },
          take: 50,
        });

        socket.emit('dm_history', history);
      } catch (err) {
        emitSocketError(socket, 'dm_history_failed', 'Error al cargar historial de mensajes privados');
      }
    });

    socket.on(
      'dm_message',
      async ({ toUserId, text, imageUrl }: { toUserId: string; text?: string; imageUrl?: string }) => {
        try {
          const me = socket.data.userId;
          const trimmedText = text?.trim() ?? '';

          if (!me || !toUserId || (trimmedText.length === 0 && !imageUrl)) {
            console.warn('dm_message: datos inválidos', { me, toUserId, textLength: trimmedText.length, hasImage: !!imageUrl });
            return;
          }

          const sender = await usersRepo.findOne({ where: { id: me } });
          const receiver = await usersRepo.findOne({ where: { id: toUserId } });

          if (!sender || !receiver) {
            console.warn('dm_message: usuario no encontrado', { sender: !!sender, receiver: !!receiver });
            return;
          }

          const message = privateRepo.create({
            contenido: trimmedText,
            imageUrl: imageUrl ?? null,
            emisor: sender,
            receptor: receiver,
          });
          const saved = await privateRepo.save(message);
          const hydrated = await privateRepo.findOne({
            where: { id: saved.id },
            relations: ['emisor', 'receptor'],
          });

          console.log('dm_message emitiendo:', {
            to: [me, toUserId],
            message: {
              id: hydrated?.id,
              contenido: hydrated?.contenido,
              imageUrl: hydrated?.imageUrl,
              emisor: { id: hydrated?.emisor?.id, nombre: hydrated?.emisor?.nombre, fotoPerfil: hydrated?.emisor?.fotoPerfil },
              receptor: { id: hydrated?.receptor?.id, nombre: hydrated?.receptor?.nombre, fotoPerfil: hydrated?.receptor?.fotoPerfil },
            },
          });

          io.to(`user:${me}`).to(`user:${toUserId}`).emit('dm_message', hydrated ?? saved);
          io.to(`user:${me}`).to(`user:${toUserId}`).emit('refresh_conversations');
        } catch (err) {
          console.error('dm_message error:', err);
          emitSocketError(socket, 'dm_send_failed', 'Error al enviar mensaje privado');
        }
      }
    );

    socket.on(
      'delete_dm',
      async ({ messageId }: { messageId: string }) => {
        try {
          const me = socket.data.userId;
          if (!me || !messageId) {
            console.warn('delete_dm: datos inválidos', { me, messageId });
            return;
          }

          const message = await privateRepo.findOne({
            where: { id: messageId },
            relations: ['emisor', 'receptor'],
          });

          if (!message) {
            console.warn('delete_dm: mensaje no encontrado', { messageId });
            return;
          }

          if (message.emisor.id !== me) {
            console.warn('delete_dm: no autorizado', { messageOwner: message.emisor.id, requester: me });
            return;
          }

          await privateRepo.remove(message);
          const toUserId = message.receptor.id;

          io.to(`user:${me}`).to(`user:${toUserId}`).emit('delete_dm_success', messageId);
        } catch (err) {
          console.error('delete_dm error:', err);
          emitSocketError(socket, 'delete_dm_failed', 'Error al borrar mensaje privado');
        }
      }
    );

    socket.on(
      'delete_event_message',
      async ({ eventId, messageId }: { eventId: string; messageId: string }) => {
        try {
          const me = socket.data.userId;
          if (!me || !eventId || !messageId) {
            console.warn('delete_event_message: datos inválidos', { me, eventId, messageId });
            return;
          }

          const message = await chatRepo.findOne({
            where: { id: messageId, evento: { id: eventId } },
            relations: ['usuario'],
          });

          if (!message) {
            console.warn('delete_event_message: mensaje no encontrado', { eventId, messageId });
            return;
          }

          if (message.usuario.id !== me) {
            console.warn('delete_event_message: no autorizado', { messageOwner: message.usuario.id, requester: me });
            return;
          }

          await chatRepo.remove(message);

          io.to(`event:${eventId}`).emit('delete_event_message_success', messageId);
        } catch (err) {
          console.error('delete_event_message error:', err);
          emitSocketError(socket, 'delete_event_message_failed', 'Error al borrar mensaje del evento');
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
