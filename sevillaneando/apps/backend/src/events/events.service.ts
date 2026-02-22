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
    console.log('📥 CREATE DTO recibido:', JSON.stringify(dto, null, 2));
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
    });
    console.log('💾 Evento antes de guardar:', JSON.stringify({ precio: event.precio, precioMin: event.precioMin, precioMax: event.precioMax }, null, 2));
    const saved = await this.eventRepo.save(event);
    console.log('✅ Evento guardado:', JSON.stringify({ id: saved.id, precio: saved.precio, precioMin: saved.precioMin, precioMax: saved.precioMax }, null, 2));
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
    console.log('📥 UPDATE DTO recibido:', JSON.stringify(dto, null, 2));
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

    const updated = {
      ...event,
      title: dto.title !== undefined ? dto.title : event.title,
      description: dto.description !== undefined ? dto.description : event.description,
      address: dto.address !== undefined ? dto.address : event.address,
      precio: dto.precio !== undefined ? dto.precio : event.precio,
      precioMin: dto.precioMin !== undefined ? dto.precioMin : event.precioMin,
      precioMax: dto.precioMax !== undefined ? dto.precioMax : event.precioMax,
      categoria: dto.categoriaId ? { id: dto.categoriaId } : event.categoria,
      estado: dto.estado !== undefined ? (dto.estado as EstadoEnum) : event.estado,
      imagen: dto.imagen !== undefined ? dto.imagen : event.imagen,
      location,
      fechaInicio,
      fechaFin,
    };
    console.log('💾 Evento antes de actualizar:', JSON.stringify({ precio: updated.precio, precioMin: updated.precioMin, precioMax: updated.precioMax }, null, 2));
    const saved = await this.eventRepo.save(updated);
    console.log('✅ Evento actualizado');
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
      relations: ['asistentes'],
    });
    if (!event) throw new NotFoundException('Evento no encontrado');

    event.asistentes = (event.asistentes ?? []).filter((att) => att.id !== userId);
    await this.eventRepo.save(event);
    return event.asistentes;
  }
}
