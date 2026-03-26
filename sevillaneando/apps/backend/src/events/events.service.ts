import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EstadoEnum } from '../enums/estado.enum';
import { Categoria } from '../entities/categoria.entity';
import { User } from '../users/user.entity';
import { v4 as uuidv4 } from 'uuid';
import { Mensaje } from '../entities/mensaje.entity';
import { Resena } from '../entities/resena.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Mensaje)
    private readonly mensajeRepo: Repository<Mensaje>,
    @InjectRepository(Resena)
    private readonly resenaRepo: Repository<Resena>,

  ) { }

  async create(dto: CreateEventDto): Promise<Event> {
    const isPrivado = dto.privado === true;
    const event = this.eventRepo.create({
      title: dto.title,
      description: dto.description,
      address: dto.address,
      location: dto.location,
      fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : undefined,
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
      precio: dto.precio !== undefined ? dto.precio : null,
      precioMin: dto.precioMin !== undefined ? dto.precioMin : null,
      precioMax: dto.precioMax !== undefined ? dto.precioMax : null,
      privado: isPrivado,
      linkAcceso: isPrivado ? uuidv4() : null,
      categoria: dto.categoriaId ? ({ id: dto.categoriaId } as Categoria) : undefined,
      estado: isPrivado ? EstadoEnum.Aprobado : EstadoEnum.Pendiente,
      creador: dto.creadorId ? ({ id: dto.creadorId } as User) : undefined,
      imagen: dto.imagen ?? undefined,
      imagenes: dto.imagenes ?? undefined,
    });
    return this.eventRepo.save(event);
  }

  async findOneByLinkAcceso(linkAcceso: string): Promise<Event> {
    const event = await this.eventRepo.findOne({
      where: { linkAcceso }});
    if (!event) throw new NotFoundException('Evento no encontrado o no es privado');
    return event;
  }

findAll(userId?: string): Promise<Event[]> {
  const query = this.eventRepo.createQueryBuilder('event')
    .leftJoinAndSelect('event.categoria', 'categoria')
    .leftJoinAndSelect('event.creador', 'creador')
    .where('(event.privado = false AND event.estado = :aprobado)', { aprobado: EstadoEnum.Aprobado });
  if (userId) {
    query.orWhere('(event.privado = true AND event.creador = :userId)', { userId });
  }
  return query.getMany();
}

  async findOne(id: string): Promise<Event> {
    const found = await this.eventRepo.findOne({
      where: { id },
      relations: ['categoria', 'creador'],
    });
    if (!found) throw new NotFoundException('Evento no encontrado');
    return found;
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);
    let location = event.location;
    if (dto.location && dto.location.type === 'Point' && Array.isArray(dto.location.coordinates)) {
      location = {
        type: 'Point',
        coordinates: [Number(dto.location.coordinates[0]), Number(dto.location.coordinates[1])],
      };
    }
    const fechaInicio = dto.fechaInicio ? new Date(dto.fechaInicio) : event.fechaInicio;
    const fechaFin = dto.fechaFin ? new Date(dto.fechaFin) : event.fechaFin;

    const wasPrivado = event.privado;
    const willBePrivado = dto.privado !== undefined ? dto.privado : event.privado;

    event.title = dto.title !== undefined ? dto.title : event.title;
    event.description = dto.description !== undefined ? dto.description : event.description;
    event.address = dto.address !== undefined ? dto.address : event.address;
    event.precio = dto.precio !== undefined ? dto.precio : event.precio;
    event.precioMin = dto.precioMin !== undefined ? dto.precioMin : event.precioMin;
    event.precioMax = dto.precioMax !== undefined ? dto.precioMax : event.precioMax;
    event.privado = willBePrivado;
    event.categoria = dto.categoriaId ? { id: dto.categoriaId } as Categoria : event.categoria;
    event.imagen = dto.imagen !== undefined ? dto.imagen : event.imagen;
    event.imagenes = dto.imagenes !== undefined ? dto.imagenes : event.imagenes;
    event.location = location;
    event.fechaInicio = fechaInicio;
    event.fechaFin = fechaFin;
    event.asistentes = event.asistentes ?? [];

    if (wasPrivado && !willBePrivado) {
      // Privado -> Público: va a moderación
      event.estado = EstadoEnum.Pendiente;
      event.linkAcceso = null;
    } else if (!wasPrivado && willBePrivado) {
      // Público -> Privado: se aprueba y genera enlace
      event.estado = EstadoEnum.Aprobado;
      event.linkAcceso = uuidv4();
    } else if (!willBePrivado) {
      // Sigue siendo público: va a moderación
      event.estado = EstadoEnum.Pendiente;
      event.linkAcceso = null;
    } else {
      // Sigue siendo privado: se aprueba
      event.estado = EstadoEnum.Aprobado;
      if (!event.linkAcceso) event.linkAcceso = uuidv4();
    }

    return this.eventRepo.save(event);
  }

  async saveDirectly(event: Event): Promise<Event> {
    return this.eventRepo.save(event);
  }

  async remove(id: string): Promise<void> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['asistentes'],
    });

    if (!event) throw new NotFoundException('Evento no encontrado');

    if (event.asistentes?.length) {
      await this.eventRepo
        .createQueryBuilder()
        .relation(Event, 'asistentes')
        .of(id)
        .remove(event.asistentes.map((attendee) => attendee.id));
    }

    await this.mensajeRepo
      .createQueryBuilder()
      .delete()
      .from(Mensaje)
      .where('eventoId = :id', { id })
      .execute();

    await this.resenaRepo
      .createQueryBuilder()
      .delete()
      .from(Resena)
      .where('eventoId = :id', { id })
      .execute();

    await this.eventRepo.delete(id);
  }

  async getAttendees(eventId: string): Promise<User[]> {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      relations: ['asistentes'],
    });
    if (!event) throw new NotFoundException('Evento no encontrado');
    return event?.asistentes ?? [];
  }

  async isAttending(eventId: string, userId: string): Promise<boolean> {
    const attendees = await this.getAttendees(eventId);
    return attendees.some((att) => att.id === userId);
  }

  async addAttendee(eventId: string, userId: string): Promise<User[]> {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      relations: ['asistentes'],
    });
    if (!event) throw new NotFoundException('Evento no encontrado');

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    event.asistentes = event.asistentes ?? [];
    if (!event.asistentes.some(att => att.id === userId)) {
      event.asistentes.push(user);
      await this.eventRepo.save(event);
    }
    return event.asistentes;
  }

  async removeAttendee(eventId: string, userId: string): Promise<User[]> {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      relations: ['asistentes', 'categoria', 'creador'],
      select: [
        'id', 'title', 'description', 'address', 'location', 'fechaInicio', 'fechaFin',
        'precio', 'linkAcceso', 'precioMin', 'precioMax', 'privado', 'categoria', 'estado', 'creador', 'imagen', 'imagenes', 'asistentes'
      ],
    });
    if (!event) throw new NotFoundException('Evento no encontrado');

    event.asistentes = (event.asistentes ?? []).filter((att) => att.id !== userId);
    await this.eventRepo.save(event);
    return event.asistentes;
  }

    async findEventsAttending(userId: string): Promise<Event[]> {
      return this.eventRepo
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.categoria', 'categoria')
        .leftJoinAndSelect('event.creador', 'creador')
        .leftJoinAndSelect('event.asistentes', 'asistentes')
        .innerJoin('event.asistentes', 'user', 'user.id = :userId', { userId })
        .getMany();
    }

    async findEventsByUser(userId: string): Promise<Event[]> {
      // Listado de edición: eventos del usuario que no están en moderación
      return this.eventRepo.createQueryBuilder('event')
        .leftJoinAndSelect('event.categoria', 'categoria')
        .leftJoinAndSelect('event.creador', 'creador')
        .where('event.creador = :userId', { userId })
        .andWhere('event.estado != :pendiente', { pendiente: EstadoEnum.Pendiente })
        .orderBy('event.fechaInicio', 'DESC')
        .getMany();
    }

    async findEventsToModerate(): Promise<Event[]> {
      // Listado de moderación: públicos pendientes
      return this.eventRepo.createQueryBuilder('event')
        .leftJoinAndSelect('event.categoria', 'categoria')
        .leftJoinAndSelect('event.creador', 'creador')
        .where('event.privado = false AND event.estado = :pendiente', { pendiente: EstadoEnum.Pendiente })
        .orderBy('event.fechaInicio', 'DESC')
        .getMany();
    }
}
