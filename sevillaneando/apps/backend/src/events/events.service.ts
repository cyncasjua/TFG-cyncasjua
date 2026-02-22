import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EstadoEnum } from '../enums/estado.enum';
import { Categoria } from '../entities/categoria.entity';
import { User } from '../users/user.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>
  ) { }

  async create(dto: CreateEventDto): Promise<Event> {
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
      categoria: dto.categoriaId ? ({ id: dto.categoriaId } as Categoria) : undefined,
      estado: EstadoEnum.Pendiente,
      creador: dto.creadorId ? ({ id: dto.creadorId } as User) : undefined,
      imagen: dto.imagen ?? undefined,
      imagenes: dto.imagenes ?? undefined,
    });
    const saved = await this.eventRepo.save(event);
    return saved;
  }

  findAll(estado: EstadoEnum = EstadoEnum.Aprobado): Promise<Event[]> {
    const where = estado ? { estado } : {};
    return this.eventRepo.find({
      where,
      relations: ['categoria', 'creador'],
    });
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

    event.title = dto.title !== undefined ? dto.title : event.title;
    event.description = dto.description !== undefined ? dto.description : event.description;
    event.address = dto.address !== undefined ? dto.address : event.address;
    event.precio = dto.precio !== undefined ? dto.precio : event.precio;
    event.precioMin = dto.precioMin !== undefined ? dto.precioMin : event.precioMin;
    event.precioMax = dto.precioMax !== undefined ? dto.precioMax : event.precioMax;
    event.categoria = dto.categoriaId ? { id: dto.categoriaId } as Categoria : event.categoria;
    event.estado = dto.estado !== undefined ? (dto.estado as EstadoEnum) : event.estado;
    event.imagen = dto.imagen !== undefined ? dto.imagen : event.imagen;
    event.imagenes = dto.imagenes !== undefined ? dto.imagenes : event.imagenes;
    event.location = location;
    event.fechaInicio = fechaInicio;
    event.fechaFin = fechaFin;
    event.asistentes = event.asistentes ?? [];

    const saved = await this.eventRepo.save(event);
    return saved;
  }

  async remove(id: string): Promise<void> {
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
        'precio', 'precioMin', 'precioMax', 'categoria', 'estado', 'creador', 'imagen', 'imagenes', 'asistentes'
      ],
    });
    if (!event) throw new NotFoundException('Evento no encontrado');

    event.asistentes = (event.asistentes ?? []).filter((att) => att.id !== userId);
    await this.eventRepo.save(event);
    return event.asistentes;
  }
}
