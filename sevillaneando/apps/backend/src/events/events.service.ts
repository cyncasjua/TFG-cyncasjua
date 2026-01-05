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
    private readonly eventRepo: Repository<Event>
  ) {}

async create(dto: CreateEventDto): Promise<Event> {
  // Busca las entidades relacionadas si los IDs están presentes
  let categoria = undefined;
  let creador = undefined;

  if (dto.categoriaId) {
    categoria = await this.eventRepo.manager.findOne(Categoria, { where: { id: String(dto.categoriaId) } });
    if (!categoria) throw new NotFoundException('Categoria no encontrada');
  }
  if (dto.creadorId) {
    creador = await this.eventRepo.manager.findOne(User, { where: { id: String(dto.creadorId) } });
    if (!creador) throw new NotFoundException('Creador no encontrado');
  }

  const event = this.eventRepo.create({
    title: dto.title,
    description: dto.description,
    address: dto.address,
    location: {
      type: 'Point',
      coordinates: [dto.longitude, dto.latitude]
    },
    fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : undefined,
    fechaFin: dto.fechaFin ? new Date(dto.fechaFin) : undefined,
    precio: dto.precio,
    estado: dto.estado as EstadoEnum,
    categoria,
    creador
  });
  return this.eventRepo.save(event);
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
    location:
      dto.latitude !== undefined && dto.longitude !== undefined
        ? { type: 'Point', coordinates: [dto.longitude, dto.latitude] }
        : event.location
  };
  await this.eventRepo.save(updated);
  return updated as Event;
}

  async remove(id: string): Promise<void> {
    await this.eventRepo.delete(id);
  }
}
