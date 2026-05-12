import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  Patch,
  ForbiddenException,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { FindEventsQueryDto } from './dto/find-events-query.dto';
import { Event } from './event.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { EstadoEnum } from './enums/estado.enum';
import { TipoEnum } from '../notificaciones/enums/tipo.enum';
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersService } from '../users/users.service';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { ThrottleModerate, ThrottleUpload } from '../common/decorators/throttle-custom.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Eventos')
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly notificacionesService: NotificacionesService,
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService
  ) {}

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @ThrottleModerate()
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Crear un nuevo evento' })
  @ApiResponse({ status: 201, description: 'Evento creado correctamente', type: Event })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async create(@Body() dto: CreateEventDto): Promise<Event> {
    return this.eventsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar eventos con filtros opcionales' })
  @ApiResponse({ status: 200, description: 'Lista de eventos', type: [Event] })
  async findAll(@Query() query: FindEventsQueryDto) {
    return this.eventsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un evento por ID' })
  @ApiParam({ name: 'id', description: 'UUID del evento' })
  @ApiResponse({ status: 200, description: 'Evento encontrado', type: Event })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async findOne(@Param('id') id: string): Promise<Event> {
    return this.eventsService.findOnePublicById(id);
  }

  @Get('acceso/:linkAcceso')
  @ApiOperation({ summary: 'Obtener un evento privado por link de acceso' })
  @ApiParam({ name: 'linkAcceso', description: 'Token de acceso al evento privado' })
  @ApiResponse({ status: 200, description: 'Evento privado encontrado', type: Event })
  @ApiResponse({ status: 404, description: 'Evento no encontrado o link inválido' })
  async getEventoPrivado(@Param('linkAcceso') linkAcceso: string): Promise<Event> {
    return this.eventsService.findOneByLinkAcceso(linkAcceso);
  }

  @Get(':id/private-share-link')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Obtener el link de acceso privado de un evento (solo creador)' })
  @ApiParam({ name: 'id', description: 'UUID del evento' })
  @ApiResponse({
    status: 200,
    description: 'Link de acceso',
    schema: { example: { linkAcceso: 'abc123' } },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (no es el creador)' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async getPrivateShareLink(@Param('id') id: string, @Req() req: { user: { uid: string } }) {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const linkAcceso = await this.eventsService.getPrivateShareLink(id, user.id);
    return { linkAcceso };
  }

  @Put(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Actualizar un evento existente' })
  @ApiParam({ name: 'id', description: 'UUID del evento' })
  @ApiResponse({ status: 200, description: 'Evento actualizado', type: Event })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async update(@Param('id') id: string, @Body() dto: UpdateEventDto): Promise<Event> {
    return this.eventsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Eliminar un evento' })
  @ApiParam({ name: 'id', description: 'UUID del evento' })
  @ApiResponse({ status: 200, description: 'Evento eliminado correctamente' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.eventsService.remove(id);
  }

  @Patch(':id/aprobar')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Aprobar un evento (admin/moderator)' })
  @ApiParam({ name: 'id', description: 'UUID del evento' })
  @ApiResponse({ status: 200, description: 'Evento aprobado', type: Event })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin permiso de admin/moderator o evento ya aprobado' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async aprobar(@Param('id') id: string): Promise<Event> {
    const event = await this.eventsService.findOne(id);
    if (event.estado === EstadoEnum.Aprobado)
      throw new ForbiddenException('El evento ya está aprobado');

    event.estado = EstadoEnum.Aprobado;
    const updated = await this.eventsService.saveDirectly(event);

    if (event.creador) {
      await this.notificacionesService.crearParaUsuario(
        event.creador,
        `Tu evento "${event.title}" ha sido aprobado y ya es visible para todos.`,
        TipoEnum.Aprobacion,
        { eventId: event.id }
      );
    }
    return updated;
  }

  @Patch(':id/rechazar')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('admin', 'moderator')
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Rechazar un evento (admin/moderator)' })
  @ApiParam({ name: 'id', description: 'UUID del evento' })
  @ApiResponse({ status: 200, description: 'Evento rechazado', type: Event })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin permiso de admin/moderator o evento ya rechazado' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async rechazar(@Param('id') id: string): Promise<Event> {
    const event = await this.eventsService.findOne(id);
    if (event.estado === EstadoEnum.Rechazado)
      throw new ForbiddenException('El evento ya está rechazado');

    event.estado = EstadoEnum.Rechazado;
    const updated = await this.eventsService.saveDirectly(event);

    if (event.creador) {
      await this.notificacionesService.crearParaUsuario(
        event.creador,
        `Tu evento "${event.title}" ha sido rechazado.`,
        TipoEnum.Rechazado,
        { eventId: event.id }
      );
    }
    return updated;
  }

  @Post('upload-image')
  @ThrottleUpload()
  @ApiOperation({ summary: 'Subir una imagen para un evento' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiResponse({
    status: 201,
    description: 'URL de la imagen subida',
    schema: { example: { url: 'https://res.cloudinary.com/...' } },
  })
  @ApiResponse({ status: 400, description: 'Archivo no proporcionado o formato no permitido' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
        if (!allowed.includes(file.mimetype)) {
          return cb(new BadRequestException('Formato no permitido'), false);
        }
        return cb(null, true);
      },
    })
  )
  async uploadEventImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido');

    const uploaded = await this.cloudinaryService.uploadImage(file.buffer, {
      folder: 'sevillaneando/event-images',
      publicIdPrefix: 'event',
    });

    return { url: uploaded.optimizedUrl };
  }

  @Get(':id/attendees')
  @ApiOperation({ summary: 'Listar asistentes de un evento' })
  @ApiParam({ name: 'id', description: 'UUID del evento' })
  @ApiResponse({
    status: 200,
    description: 'Lista de asistentes',
    schema: { example: [{ id: 'uuid', nombre: 'Ana', fotoPerfil: null }] },
  })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async listAttendees(@Param('id') id: string) {
    const attendees = await this.eventsService.getAttendees(id);
    return attendees.map((user) => ({
      id: user.id,
      nombre: user.nombre,
      fotoPerfil: user.fotoPerfil,
    }));
  }

  @Get(':id/attendees/me')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Comprobar si el usuario actual asiste a un evento' })
  @ApiParam({ name: 'id', description: 'UUID del evento' })
  @ApiResponse({
    status: 200,
    description: 'Estado de asistencia',
    schema: { example: { attending: true } },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async myAttendance(@Param('id') id: string, @Req() req: { user: { uid: string } }) {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const attending = await this.eventsService.isAttending(id, user.id);
    return { attending };
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Obtener reseñas de un evento' })
  @ApiParam({ name: 'id', description: 'UUID del evento' })
  @ApiResponse({
    status: 200,
    description: 'Lista de reseñas',
    schema: {
      example: [
        {
          id: 'uuid',
          puntuacion: 4,
          comentario: 'Muy bien',
          fecha: '2025-06-01',
          autor: { id: 'uuid', nombre: 'Ana', fotoPerfil: null },
        },
      ],
    },
  })
  async getEventReviews(@Param('id') id: string) {
    const reviews = await this.eventsService.getEventReviews(id);
    return reviews.map((review) => ({
      id: review.id,
      puntuacion: review.puntuacion,
      comentario: review.comentario,
      fecha: review.fecha,
      autor: {
        id: review.autor?.id,
        nombre: review.autor?.nombre,
        fotoPerfil: review.autor?.fotoPerfil,
      },
    }));
  }

  @Post(':id/attendees')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Apuntarse a un evento' })
  @ApiParam({ name: 'id', description: 'UUID del evento' })
  @ApiResponse({
    status: 201,
    description: 'Lista actualizada de asistentes',
    schema: { example: [{ id: 'uuid', nombre: 'Ana', fotoPerfil: null }] },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Evento o usuario no encontrado' })
  async attend(@Param('id') id: string, @Req() req: { user: { uid: string } }) {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const attendees = await this.eventsService.addAttendee(id, user.id);
    return attendees.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      fotoPerfil: u.fotoPerfil,
    }));
  }

  @Delete(':id/attendees')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Desapuntarse de un evento' })
  @ApiParam({ name: 'id', description: 'UUID del evento' })
  @ApiResponse({
    status: 200,
    description: 'Lista actualizada de asistentes',
    schema: { example: [{ id: 'uuid', nombre: 'Ana', fotoPerfil: null }] },
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Evento o usuario no encontrado' })
  async unattend(@Param('id') id: string, @Req() req: { user: { uid: string } }) {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const attendees = await this.eventsService.removeAttendee(id, user.id);
    return attendees.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      fotoPerfil: u.fotoPerfil,
    }));
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Listar eventos creados por un usuario' })
  @ApiParam({ name: 'userId', description: 'UUID del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de eventos del usuario', type: [Event] })
  async findEventsByUser(@Param('userId') userId: string): Promise<Event[]> {
    return this.eventsService.findEventsByUser(userId);
  }

  @Get('moderacion/list')
  @ApiOperation({ summary: 'Listar eventos pendientes de moderación' })
  @ApiResponse({ status: 200, description: 'Lista de eventos pendientes', type: [Event] })
  async findEventsToModerate(): Promise<Event[]> {
    return this.eventsService.findEventsToModerate();
  }

  @Get('attending/:userId')
  @ApiOperation({ summary: 'Listar eventos a los que asiste un usuario' })
  @ApiParam({ name: 'userId', description: 'UUID del usuario' })
  @ApiResponse({
    status: 200,
    description: 'Lista de eventos a los que asiste el usuario',
    type: [Event],
  })
  async findEventsAttending(@Param('userId') userId: string): Promise<Event[]> {
    return this.eventsService.findEventsAttending(userId);
  }
}
