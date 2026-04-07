import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

type EventWithRatingsSummary = Event & {
  ratingAverage?: number | null;
  ratingsCount?: number;
};

type EventVisibilityState = {
  estado: EstadoEnum;
  linkAcceso: string | null;
};

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

  private parseOptionalDate(value?: string | null): Date | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('La fecha proporcionada no es válida.');
    }

    return parsed;
  }

  /**
   * Convierte imagenes a array si es string JSON o CSV
   */
  private parseImagenes(imagenes: any): string[] {
    if (!imagenes) return [];

    if (Array.isArray(imagenes)) {
      return imagenes.filter(url => typeof url === 'string' && url.trim());
    }

    if (typeof imagenes === 'string') {
      // Intentar parsear como JSON primero
      if (imagenes.startsWith('[')) {
        try {
          const parsed = JSON.parse(imagenes);
          if (Array.isArray(parsed)) {
            return parsed.filter(url => typeof url === 'string' && url.trim());
          }
        } catch (e) {
          console.warn('[parseImagenes] JSON parse failed:', e);
        }
      }
      // Si no es JSON, intentar como CSV
      return imagenes.split(',').map(s => s.trim()).filter(s => s);
    }

    return [];
  }

  /**
   * Asegura que el array de imagenes en la entidad es array (deserializa si es necessary)
   */
  private ensureImagenesCorrectFormat(event: Event): void {
    if (event.imagenes) {
      (event as any).imagenes = this.parseImagenes(event.imagenes);
    }
  }

  /**
   * Prepara el evento para ser guardado en BD, convirtiendo imagenes a JSON string
   */
  private prepareEventForSave(event: Event): Event {
    if (event.imagenes !== undefined && event.imagenes !== null) {
      const imgArray = this.parseImagenes(event.imagenes);
      (event as any).imagenes = JSON.stringify(imgArray);
    }
    return event;
  }

  /**
   * Procesa un array de eventos para asegurar formato correcto de imagenes
   */
  private processEventArray(events: Event[]): Event[] {
    events.forEach(event => this.ensureImagenesCorrectFormat(event));
    return events;
  }

  async create(dto: CreateEventDto): Promise<Event> {
    let event = this.eventRepo.create(this.buildEventData(dto));
    event = this.prepareEventForSave(event);
    const saved = await this.eventRepo.save(event);
    this.ensureImagenesCorrectFormat(saved);
    return saved;
  }

  async findOneByLinkAcceso(linkAcceso: string): Promise<Event> {
    const event = await this.eventRepo.findOne({
      where: { linkAcceso },
      relations: ['categoria', 'creador'],
    });
    if (!event) throw new NotFoundException('Evento no encontrado o no es privado');
    this.ensureImagenesCorrectFormat(event);
    return this.attachRatingsSummary(event);
  }

  async getPrivateShareLink(eventId: string, requesterId: string): Promise<string> {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      relations: ['creador'],
    });

    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    if (!event.privado) {
      throw new ForbiddenException('Solo los eventos privados tienen enlace de acceso');
    }

    if (!event.creador || event.creador.id !== requesterId) {
      throw new ForbiddenException('Solo el creador puede compartir el enlace de este evento');
    }

    if (!event.linkAcceso) {
      event.linkAcceso = uuidv4();
      await this.eventRepo.save(event);
    }

    return event.linkAcceso;
  }

  findAll(userId?: string): Promise<Event[]> {
    const query = this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.categoria', 'categoria')
      .leftJoinAndSelect('event.creador', 'creador')
      .leftJoinAndSelect('event.asistentes', 'asistentes')
      .where('(event.privado = false AND event.estado = :aprobado)', { aprobado: EstadoEnum.Aprobado });

    if (userId) {
      query.orWhere('(event.privado = true AND event.creador = :userId)', { userId });
    }

    return query.getMany().then(events => this.processEventArray(events));
  }

  async findOne(id: string): Promise<Event> {
    const found = await this.eventRepo.findOne({
      where: { id },
      relations: ['categoria', 'creador'],
    });
    if (!found) throw new NotFoundException('Evento no encontrado');
    this.ensureImagenesCorrectFormat(found);
    return found;
  }

  async findOnePublicById(id: string): Promise<Event> {
    const found = await this.eventRepo.findOne({
      where: { id, privado: false, estado: EstadoEnum.Aprobado },
      relations: ['categoria', 'creador'],
    });
    if (!found) throw new NotFoundException('Evento no encontrado');
    this.ensureImagenesCorrectFormat(found);
    return this.attachRatingsSummary(found);
  }

  private async attachRatingsSummary(event: Event): Promise<Event> {
    const raw = await this.resenaRepo
      .createQueryBuilder('resena')
      .select('AVG(resena.puntuacion)', 'avgRating')
      .addSelect('COUNT(resena.id)', 'ratingsCount')
      .where('resena.eventoId = :eventId', { eventId: event.id })
      .getRawOne<{ avgRating: string | null; ratingsCount: string }>();

    const ratingsCount = Number(raw?.ratingsCount ?? 0);
    const avgRating = raw?.avgRating !== null && raw?.avgRating !== undefined
      ? Number(raw.avgRating)
      : null;
    const eventWithSummary = event as EventWithRatingsSummary;

    eventWithSummary.ratingAverage = Number.isFinite(avgRating as number)
      ? Number((avgRating as number).toFixed(2))
      : null;
    eventWithSummary.ratingsCount = Number.isFinite(ratingsCount) ? ratingsCount : 0;

    return event;
  }

  private buildEventData(dto: CreateEventDto): Partial<Event> {
    const isPrivado = dto.privado === true;

    return {
      title: dto.title,
      description: dto.description,
      address: dto.address,
      location: dto.location,
      fechaInicio: this.parseOptionalDate(dto.fechaInicio),
      fechaFin: this.parseOptionalDate(dto.fechaFin),
      precio: dto.precio !== undefined ? dto.precio : null,
      precioMin: dto.precioMin !== undefined ? dto.precioMin : null,
      precioMax: dto.precioMax !== undefined ? dto.precioMax : null,
      privado: isPrivado,
      linkAcceso: isPrivado ? uuidv4() : null,
      categoria: dto.categoriaId ? ({ id: dto.categoriaId } as Categoria) : undefined,
      estado: isPrivado ? EstadoEnum.Aprobado : EstadoEnum.Pendiente,
      creador: dto.creadorId ? ({ id: dto.creadorId } as User) : undefined,
      imagen: dto.imagen ?? undefined,
      imagenes: dto.imagenes ? JSON.stringify(dto.imagenes) : undefined,
    };
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);
    const wasPrivado = event.privado;
    const willBePrivado = dto.privado !== undefined ? dto.privado : event.privado;

    this.applyEventUpdates(event, dto);
    event.privado = willBePrivado;
    event.asistentes = event.asistentes ?? [];

    const visibilityState = this.resolveVisibilityState(wasPrivado, willBePrivado, event.linkAcceso ?? null);
    event.estado = visibilityState.estado;
    event.linkAcceso = visibilityState.linkAcceso;

    const toSave = this.prepareEventForSave(event);
    const saved = await this.eventRepo.save(toSave);
    this.ensureImagenesCorrectFormat(saved);
    return saved;
  }

  private applyEventUpdates(event: Event, dto: UpdateEventDto): void {
    if (dto.location && dto.location.type === 'Point' && Array.isArray(dto.location.coordinates)) {
      event.location = {
        type: 'Point',
        coordinates: [Number(dto.location.coordinates[0]), Number(dto.location.coordinates[1])],
      };
    }

    event.title = dto.title !== undefined ? dto.title : event.title;
    event.description = dto.description !== undefined ? dto.description : event.description;
    event.address = dto.address !== undefined ? dto.address : event.address;
    event.precio = dto.precio !== undefined ? dto.precio : event.precio;
    event.precioMin = dto.precioMin !== undefined ? dto.precioMin : event.precioMin;
    event.precioMax = dto.precioMax !== undefined ? dto.precioMax : event.precioMax;
    event.categoria = dto.categoriaId ? ({ id: dto.categoriaId } as Categoria) : event.categoria;
    event.imagen = dto.imagen !== undefined ? dto.imagen : event.imagen;

    // Normalizar imagenes - convertir a array común format
    if (dto.imagenes !== undefined) {
      const normalized = this.parseImagenes(dto.imagenes);
      (event as any).imagenes = normalized.length > 0 ? normalized : undefined;
    }

    event.fechaInicio = dto.fechaInicio !== undefined ? this.parseOptionalDate(dto.fechaInicio) : event.fechaInicio;
    event.fechaFin = dto.fechaFin !== undefined ? this.parseOptionalDate(dto.fechaFin) : event.fechaFin;
  }

  private resolveVisibilityState(
    wasPrivado: boolean | null | undefined,
    willBePrivado: boolean | null | undefined,
    currentLinkAcceso: string | null,
  ): EventVisibilityState {
    if (wasPrivado && !willBePrivado) {
      return { estado: EstadoEnum.Pendiente, linkAcceso: null };
    }

    if (!wasPrivado && willBePrivado) {
      return { estado: EstadoEnum.Aprobado, linkAcceso: uuidv4() };
    }

    if (!willBePrivado) {
      return { estado: EstadoEnum.Pendiente, linkAcceso: null };
    }

    return {
      estado: EstadoEnum.Aprobado,
      linkAcceso: currentLinkAcceso ?? uuidv4(),
    };
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
    const toSave = this.prepareEventForSave(event);
    await this.eventRepo.save(toSave);
    return event.asistentes;
  }

    async findEventsAttending(userId: string): Promise<Event[]> {
      const events = await this.eventRepo
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.categoria', 'categoria')
        .leftJoinAndSelect('event.creador', 'creador')
        .leftJoinAndSelect('event.asistentes', 'asistentes')
        .innerJoin('event.asistentes', 'user', 'user.id = :userId', { userId })
        .getMany();
      return this.processEventArray(events);
    }

    async findEventsByUser(userId: string): Promise<Event[]> {
      const events = await this.eventRepo.createQueryBuilder('event')
        .leftJoinAndSelect('event.categoria', 'categoria')
        .leftJoinAndSelect('event.creador', 'creador')
        .where('event.creador = :userId', { userId })
        .andWhere('event.estado != :pendiente', { pendiente: EstadoEnum.Pendiente })
        .orderBy('event.fechaInicio', 'DESC')
        .getMany();
      return this.processEventArray(events);
    }

    async findEventsToModerate(): Promise<Event[]> {
      const events = await this.eventRepo.createQueryBuilder('event')
        .leftJoinAndSelect('event.categoria', 'categoria')
        .leftJoinAndSelect('event.creador', 'creador')
        .where('event.privado = false AND event.estado = :pendiente', { pendiente: EstadoEnum.Pendiente })
        .orderBy('event.fechaInicio', 'DESC')
        .getMany();
      return this.processEventArray(events);
    }
}
