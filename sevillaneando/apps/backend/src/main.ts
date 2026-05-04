import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { DataSource } from 'typeorm';
import { Event } from './events/event.entity';
import { seedEvents } from './database/seed';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Server, Socket } from 'socket.io';
import { Mensaje } from './chat/mensaje.entity';
import { FirebaseService } from './auth/firebase.service';
import { User } from './users/user.entity';
import { MensajePrivado } from './chat/mensaje-privado.entity';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:8081', 'http://localhost:19006'];

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    },
  });
  app.set('trust proxy', 1);
  app.useGlobalFilters(new AllExceptionsFilter());
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
      origin: allowedOrigins,
      credentials: true,
    },
  });

  function emitSocketError(socket: Socket, code: string, message: string) {
    socket.emit('chat_error', { code, message });
  }

  // Ventana de 10 s, máximo 10 mensajes por usuario
  const socketMessageCounts = new Map<string, { count: number; resetAt: number }>();
  function checkSocketRateLimit(socketId: string): boolean {
    const now = Date.now();
    const window = 10_000;
    const maxPerWindow = 10;
    const entry = socketMessageCounts.get(socketId);
    if (!entry || now > entry.resetAt) {
      socketMessageCounts.set(socketId, { count: 1, resetAt: now + window });
      return true;
    }
    if (entry.count >= maxPerWindow) return false;
    entry.count++;
    return true;
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
    } catch (err) {
      logger.warn('Fallo en autenticacion de socket', err as Error);
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
        logger.warn(`Usuario no encontrado en DB con firebaseUid: ${firebaseUid}`);
      }
    } else {
      logger.warn('Sin firebaseUid en socket.data.user');
    }

    socket.on('disconnect', () => {
      socketMessageCounts.delete(socket.id);
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
                leido: false,
              },
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
        logger.error('Error obteniendo conversaciones', err as Error);
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
      } catch (err) {
        logger.error('Error al cargar historial de chat de evento', err as Error);
        emitSocketError(socket, 'history_failed', 'Error al cargar el historial');
      }
    });

    socket.on(
      'chat_message',
      async ({
        eventId,
        text,
        imageUrl,
      }: {
        eventId: string;
        text?: string;
        imageUrl?: string;
      }) => {
        if (!checkSocketRateLimit(socket.id)) {
          emitSocketError(socket, 'rate_limit', 'Demasiados mensajes. Espera unos segundos.');
          return;
        }
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
          logger.error('Error guardando mensaje de evento', err as Error);
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
        emitSocketError(
          socket,
          'dm_history_failed',
          'Error al cargar historial de mensajes privados'
        );
      }
    });

    socket.on('mark_as_read', async ({ senderId }: { senderId: string }) => {
      try {
        const me = socket.data.userId;
        if (!me || !senderId) return;

        await privateRepo.update(
          {
            receptor: { id: me },
            emisor: { id: senderId },
            leido: false,
          },
          { leido: true }
        );

        io.to(`user:${me}`).emit('refresh_conversations');
      } catch (err) {
        emitSocketError(
          socket,
          'dm_mark_read_failed',
          'Error al marcar mensajes privados como leidos'
        );
      }
    });

    socket.on(
      'dm_message',
      async ({
        toUserId,
        text,
        imageUrl,
      }: {
        toUserId: string;
        text?: string;
        imageUrl?: string;
      }) => {
        if (!checkSocketRateLimit(socket.id)) {
          emitSocketError(socket, 'rate_limit', 'Demasiados mensajes. Espera unos segundos.');
          return;
        }
        try {
          const me = socket.data.userId;
          const trimmedText = text?.trim() ?? '';

          if (!me || !toUserId || (trimmedText.length === 0 && !imageUrl)) {
            logger.warn(
              `dm_message: datos inválidos ${JSON.stringify({ me, toUserId, textLength: trimmedText.length, hasImage: !!imageUrl })}`
            );
            return;
          }

          const sender = await usersRepo.findOne({ where: { id: me } });
          const receiver = await usersRepo.findOne({ where: { id: toUserId } });

          if (!sender || !receiver) {
            logger.warn(
              `dm_message: usuario no encontrado ${JSON.stringify({ sender: !!sender, receiver: !!receiver })}`
            );
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

          io.to(`user:${me}`)
            .to(`user:${toUserId}`)
            .emit('dm_message', hydrated ?? saved);
          io.to(`user:${me}`).to(`user:${toUserId}`).emit('refresh_conversations');
        } catch (err) {
          logger.error('dm_message error', err as Error);
          emitSocketError(socket, 'dm_send_failed', 'Error al enviar mensaje privado');
        }
      }
    );

    socket.on('delete_dm', async ({ messageId }: { messageId: string }) => {
      try {
        const me = socket.data.userId;
        if (!me || !messageId) {
          logger.warn(`delete_dm: datos inválidos ${JSON.stringify({ me, messageId })}`);
          return;
        }

        const message = await privateRepo.findOne({
          where: { id: messageId },
          relations: ['emisor', 'receptor'],
        });

        if (!message) {
          logger.warn(`delete_dm: mensaje no encontrado ${JSON.stringify({ messageId })}`);
          return;
        }

        if (message.emisor.id !== me) {
          logger.warn(
            `delete_dm: no autorizado ${JSON.stringify({ messageOwner: message.emisor.id, requester: me })}`
          );
          return;
        }

        await privateRepo.remove(message);
        const toUserId = message.receptor.id;

        io.to(`user:${me}`).to(`user:${toUserId}`).emit('delete_dm_success', messageId);
      } catch (err) {
        logger.error('delete_dm error', err as Error);
        emitSocketError(socket, 'delete_dm_failed', 'Error al borrar mensaje privado');
      }
    });

    socket.on(
      'delete_event_message',
      async ({ eventId, messageId }: { eventId: string; messageId: string }) => {
        try {
          const me = socket.data.userId;
          if (!me || !eventId || !messageId) {
            logger.warn(
              `delete_event_message: datos inválidos ${JSON.stringify({ me, eventId, messageId })}`
            );
            return;
          }

          const message = await chatRepo.findOne({
            where: { id: messageId, evento: { id: eventId } },
            relations: ['usuario'],
          });

          if (!message) {
            logger.warn(
              `delete_event_message: mensaje no encontrado ${JSON.stringify({ eventId, messageId })}`
            );
            return;
          }

          if (message.usuario.id !== me) {
            logger.warn(
              `delete_event_message: no autorizado ${JSON.stringify({ messageOwner: message.usuario.id, requester: me })}`
            );
            return;
          }

          await chatRepo.remove(message);

          io.to(`event:${eventId}`).emit('delete_event_message_success', messageId);
        } catch (err) {
          logger.error('delete_event_message error', err as Error);
          emitSocketError(
            socket,
            'delete_event_message_failed',
            'Error al borrar mensaje del evento'
          );
        }
      }
    );
  });

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: any, res: any) => res.json({ status: 'ok' }));

  const eventRepo = dataSource.getRepository(Event);
  await seedEvents(eventRepo, dataSource);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`API escuchando en http://localhost:${port}`);
}

bootstrap();
