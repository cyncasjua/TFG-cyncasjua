import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

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
      location: `SRID=4326;POINT(${dto.longitude} ${dto.latitude})`
    });
    return this.eventRepo.save(event);
  }

  findAll(): Promise<Event[]> {
    return this.eventRepo.find();
  }

  async findOne(id: string): Promise<Event> {
    const found = await this.eventRepo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Evento no encontrado');
    return found;
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);
    const updated = {
      ...event,
      ...dto,
      location:
        dto.latitude !== undefined && dto.longitude !== undefined
          ? `SRID=4326;POINT(${dto.longitude} ${dto.latitude})`
          : event.location
    };
    await this.eventRepo.save(updated);
    return updated as Event;
  }

  async remove(id: string): Promise<void> {
    await this.eventRepo.delete(id);
  }
}
