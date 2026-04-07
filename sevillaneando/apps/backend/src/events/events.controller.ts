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
import { Event } from './event.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { EstadoEnum } from '../enums/estado.enum';
import { TipoEnum } from '../enums/tipo.enum';
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersService } from '../users/users.service';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly notificacionesService: NotificacionesService,
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService
  ) { }

  @Post()
  async create(@Body() dto: CreateEventDto): Promise<Event> {
    return this.eventsService.create(dto);
  }

  @Get()
  async findAll(@Query('userId') userId?: string): Promise<Event[]> {
    return this.eventsService.findAll(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Event> {
    return this.eventsService.findOnePublicById(id);
  }

  @Get('acceso/:linkAcceso')
  async getEventoPrivado(@Param('linkAcceso') linkAcceso: string): Promise<Event> {
    return this.eventsService.findOneByLinkAcceso(linkAcceso);
  }

  @Get(':id/private-share-link')
  @UseGuards(FirebaseAuthGuard)
  async getPrivateShareLink(@Param('id') id: string, @Req() req: { user: { uid: string } }) {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const linkAcceso = await this.eventsService.getPrivateShareLink(id, user.id);
    return { linkAcceso };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateEventDto): Promise<Event> {
    return this.eventsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    return this.eventsService.remove(id);
  }

@Patch(':id/aprobar')
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
        TipoEnum.Aprobacion
      );
    }
    return updated;
  }

  @Patch(':id/rechazar')
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
        TipoEnum.Rechazado
      );
    }
    return updated;
  }

  @Post('upload-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
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
  async myAttendance(@Param('id') id: string, @Req() req: { user: { uid: string } }) {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const attending = await this.eventsService.isAttending(id, user.id);
    return { attending };
  }

  @Post(':id/attendees')
  @UseGuards(FirebaseAuthGuard)
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
  async findEventsByUser(@Param('userId') userId: string): Promise<Event[]> {
    return this.eventsService.findEventsByUser(userId);
  }

  @Get('moderacion/list')
  async findEventsToModerate(): Promise<Event[]> {
    return this.eventsService.findEventsToModerate();
  }

  @Get('attending/:userId')
  async findEventsAttending(@Param('userId') userId: string): Promise<Event[]> {
    return this.eventsService.findEventsAttending(userId);
  }
}
