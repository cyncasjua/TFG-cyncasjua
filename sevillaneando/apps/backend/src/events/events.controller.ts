import {
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
import { TipoEnum } from 'src/enums/tipo.enum';
import { UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { UsersService } from 'src/users/users.service';
import { FirebaseAuthGuard } from '../auth/firebase.guard';

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly notificacionesService: NotificacionesService,
    private readonly usersService: UsersService
  ) { }

  @Post()
  async create(@Body() dto: CreateEventDto): Promise<Event> {
    return this.eventsService.create(dto);
  }

  @Get()
  async findAll(@Query('estado') estado?: string): Promise<Event[]> {
    const estadoEnum = estado ? EstadoEnum[estado as keyof typeof EstadoEnum] : undefined;
    return this.eventsService.findAll(estadoEnum);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Event> {
    return this.eventsService.findOne(id);
  }

  @Get('acceso/:linkAcceso')
  async getEventoPrivado(@Param('linkAcceso') linkAcceso: string): Promise<Event> {
    return this.eventsService.findOneByLinkAcceso(linkAcceso);
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
    const updateDto: UpdateEventDto = {
      ...event,
      fechaInicio:
        event.fechaInicio instanceof Date ? event.fechaInicio.toISOString() : event.fechaInicio,
      fechaFin: event.fechaFin instanceof Date ? event.fechaFin.toISOString() : event.fechaFin,
    };
    const updated = await this.eventsService.update(id, updateDto);
    if (event.creador) {
      await this.notificacionesService.crearParaUsuario(
        event.creador,
        `Tu evento "${event.title}" ha sido aprobado y ya es visible para todos los usuarios.`,
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
    const updateDto: UpdateEventDto = {
      ...event,
      fechaInicio:
        event.fechaInicio instanceof Date ? event.fechaInicio.toISOString() : event.fechaInicio,
      fechaFin: event.fechaFin instanceof Date ? event.fechaFin.toISOString() : event.fechaFin,
    };
    const updated = await this.eventsService.update(id, updateDto);
    if (event.creador) {
      await this.notificacionesService.crearParaUsuario(
        event.creador,
        `Tu evento "${event.title}" ha sido rechazado. No será visible para otros usuarios.`,
        TipoEnum.Rechazado
      );
    }
    return updated;
  }

  @Post('upload-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/event-images',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
    })
  )
  uploadEventImage(@UploadedFile() file: import('multer').File) {
    return { url: `/uploads/event-images/${file.filename}` };
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
  async myAttendance(@Param('id') id: string, @Req() req) {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const attending = await this.eventsService.isAttending(id, user.id);
    return { attending };
  }

  @Post(':id/attendees')
  @UseGuards(FirebaseAuthGuard)
  async attend(@Param('id') id: string, @Req() req) {
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
  async unattend(@Param('id') id: string, @Req() req) {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const attendees = await this.eventsService.removeAttendee(id, user.id);
    return attendees.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      fotoPerfil: u.fotoPerfil,
    }));
  }
}
