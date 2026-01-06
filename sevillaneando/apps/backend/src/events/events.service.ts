import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EstadoEnum } from '../enums/estado.enum';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>
  ) {}

async create(dto: CreateEventDto): Promise<Event> {
  const event = this.eventRepo.create({
    title: dto.title,
    description: dto.description,
    address: dto.address,
    location: dto.location,
    fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : undefined,
    fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
    precio: dto.precio ?? 0, 
    categoria: dto.categoriaId ? { id: dto.categoriaId } as any : undefined,
    estado: EstadoEnum.Pendiente,
    creador: dto.creadorId ? { id: dto.creadorId } as any : undefined,
    imagen: dto.imagen ?? undefined,
  });
  return await this.eventRepo.save(event);
}

  findAll(estado: EstadoEnum = EstadoEnum.Aprobado): Promise<Event[]> {
    const where = estado ? { estado } : {};
    return this.eventRepo.find({
      where,
      relations: ['categoria', 'creador']
    });
  }

  async findOne(id: string): Promise<Event> {
    const found = await this.eventRepo.findOne({
      where: { id },
      relations: ['categoria', 'creador']
    });
    if (!found) throw new NotFoundException('Evento no encontrado');
    return found;
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);
    const updated = {
      ...event,
      ...dto,
      estado: dto.estado !== undefined ? dto.estado as EstadoEnum : event.estado,
      location: dto.location ? dto.location : event.location
    };
    await this.eventRepo.save(updated);
    return updated as Event;
  }

  async remove(id: string): Promise<void> {
    await this.eventRepo.delete(id);
  }
}