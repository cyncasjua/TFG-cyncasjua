import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEditRequest } from './event-edit-request.entity';
import { Event } from './event.entity';
import { User } from '../users/user.entity';
import { EventEditRequestDto } from './dto/event-edit-request.dto';

@Injectable()
export class EventEditRequestService {
  constructor(
    @InjectRepository(EventEditRequest)
    private readonly editRequestRepo: Repository<EventEditRequest>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>
  ) {}

  async create(
    eventId: string,
    userId: string,
    dto: EventEditRequestDto
  ): Promise<EventEditRequest> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const editRequest = this.editRequestRepo.create({
      ...dto,
      event,
      requestedBy: user,
      status: 'pendiente',
    });
    return this.editRequestRepo.save(editRequest);
  }

  async approve(requestId: string): Promise<Event> {
    const editRequest = await this.editRequestRepo.findOne({
      where: { id: requestId },
      relations: ['event'],
    });
    if (!editRequest) throw new NotFoundException('Solicitud no encontrada');
    if (editRequest.status !== 'pendiente')
      throw new ForbiddenException('La solicitud ya fue gestionada');
    const event = editRequest.event;
    Object.assign(event, editRequest);
    await this.eventRepo.save(event);
    editRequest.status = 'aprobada';
    await this.editRequestRepo.save(editRequest);
    return event;
  }

  async reject(requestId: string, motivoRechazo?: string): Promise<EventEditRequest> {
    const editRequest = await this.editRequestRepo.findOne({ where: { id: requestId } });
    if (!editRequest) throw new NotFoundException('Solicitud no encontrada');
    if (editRequest.status !== 'pendiente')
      throw new ForbiddenException('La solicitud ya fue gestionada');
    editRequest.status = 'rechazada';
    editRequest.motivoRechazo = motivoRechazo;
    return this.editRequestRepo.save(editRequest);
  }

  async findPendingByEvent(eventId: string): Promise<EventEditRequest[]> {
    return this.editRequestRepo.find({ where: { event: { id: eventId }, status: 'pendiente' } });
  }

  async findAll(): Promise<EventEditRequest[]> {
    return this.editRequestRepo.find({ relations: ['event', 'requestedBy'] });
  }
}
