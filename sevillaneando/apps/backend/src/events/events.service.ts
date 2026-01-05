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
      ...dto,
      estado: dto.estado as EstadoEnum, // Ensure correct enum type
      location: dto.location, // Ensure this matches the Event entity type
      fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : undefined,
      fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
    });
    return await this.eventRepo.save(event);
  }

  findAll(): Promise<Event[]> {
    return this.eventRepo.find({
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