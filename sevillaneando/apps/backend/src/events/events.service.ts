import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Event } from './event.entity';
import { FindEventsQueryDto } from './dto/find-events-query.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EstadoEnum } from './enums/estado.enum';
import { RecurrenciaEnum } from './enums/recurrencia.enum';
import { Categoria } from '../categorias/categoria.entity';
import { User } from '../users/user.entity';
import { v4 as uuidv4 } from 'uuid';
import { Mensaje } from '../chat/mensaje.entity';
import { Resena } from './resena.entity';
import { parseEventImages, stringifyEventImages } from './event-images.util';

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
    private readonly resenaRepo: Repository<Resena>
  ) {}

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
   * Asegura que el array de imagenes en la entidad es array (deserializa si es necessary)
   */
  private ensureImagenesCorrectFormat(event: Event): void {
    if (event.imagenes) {
      event.imagenes = parseEventImages(event.imagenes);
    }
  }

  private prepareEventForSave(event: Event): Event {
    if (event.imagenes !== undefined && event.imagenes !== null) {
      event.imagenes = stringifyEventImages(event.imagenes);
    }
    return event;
  }

  private processEventArray(events: Event[]): Event[] {
    events.forEach((event) => this.ensureImagenesCorrectFormat(event));
    return events;
  }

  async create(dto: CreateEventDto): Promise<Event> {
    let event = this.eventRepo.create(this.buildEventData(dto));
    event = this.prepareEventForSave(event);
    const saved = await this.eventRepo.save(event);
    this.ensureImagenesCorrectFormat(saved);

    if (saved.recurrencia && saved.recurrenciaFin) {
      const instancias = this.generarInstanciasRecurrentes(saved);
      if (instancias.length > 0) {
        await this.eventRepo.save(instancias.map((i) => this.eventRepo.create(i)));
      }
    }

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

  async findAll(
    query: FindEventsQueryDto = {}
  ): Promise<{ events: (Event & { distanceKm?: number })[]; hasMore: boolean }> {
    const { userId, lat, lng, radiusKm, limit, offset = 0 } = query;
    const hasLocation = lat != null && lng != null;

    const qb = this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.categoria', 'categoria')
      .leftJoin('event.creador', 'creador')
      .addSelect(['creador.id', 'creador.nombre', 'creador.fotoPerfil'])
      .where(
        new Brackets((qb2) => {
          qb2.where('event.privado = false AND event.estado = :aprobado', {
            aprobado: EstadoEnum.Aprobado,
          });
          if (userId) {
            qb2.orWhere('event.privado = true AND creador.id = :userId', { userId });
          }
        })
      );

    if (hasLocation) {
      qb.addSelect(
        'ST_Distance(event.location::geography, ST_MakePoint(:lng, :lat)::geography) / 1000',
        'distanceKm'
      ).setParameters({ lat, lng });

      if (radiusKm != null) {
        qb.andWhere(
          'ST_DWithin(event.location::geography, ST_MakePoint(:lng, :lat)::geography, :radiusMeters)',
          { radiusMeters: radiusKm * 1000 }
        );
      }

      qb.orderBy('"distanceKm"', 'ASC');
    } else {
      qb.orderBy('event.fechaInicio', 'ASC');
    }

    if (limit != null) {
      qb.limit(limit);
    }
    qb.offset(offset);

    const { raw, entities } = await qb.getRawAndEntities();

    this.processEventArray(entities);

    const events = entities.map((event, i) => {
      if (!hasLocation) return event;
      const rawDistKm = raw[i]?.distanceKm;
      const distanceKm = rawDistKm != null ? Number(rawDistKm) : undefined;
      return distanceKm !== undefined ? Object.assign(event, { distanceKm }) : event;
    });

    return { events, hasMore: false };
  }

  findAllForScheduler(): Promise<Event[]> {
    return this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.categoria', 'categoria')
      .leftJoinAndSelect('event.creador', 'creador')
      .leftJoinAndSelect('event.asistentes', 'asistentes')
      .where('event.privado = false AND event.estado = :aprobado', {
        aprobado: EstadoEnum.Aprobado,
      })
      .getMany()
      .then((events) => this.processEventArray(events));
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
    const avgRating =
      raw?.avgRating !== null && raw?.avgRating !== undefined ? Number(raw.avgRating) : null;
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
      recurrencia: dto.recurrencia ?? null,
      recurrenciaFin: dto.recurrenciaFin ? new Date(dto.recurrenciaFin) : null,
    };
  }

  private getRecurrenciaDias(recurrencia: RecurrenciaEnum): number {
    const map: Record<RecurrenciaEnum, number> = {
      [RecurrenciaEnum.Diario]: 1,
      [RecurrenciaEnum.Semanal]: 7,
      [RecurrenciaEnum.Quincenal]: 14,
      [RecurrenciaEnum.Mensual]: 30,
    };
    return map[recurrencia];
  }

  private generarInstanciasRecurrentes(base: Event): Partial<Event>[] {
    if (!base.recurrencia || !base.fechaInicio || !base.recurrenciaFin) return [];

    const intervaloDias = this.getRecurrenciaDias(base.recurrencia);
    const duracionMs = base.fechaFin ? base.fechaFin.getTime() - base.fechaInicio.getTime() : 0;
    const instancias: Partial<Event>[] = [];
    const cursor = new Date(base.fechaInicio);
    cursor.setDate(cursor.getDate() + intervaloDias);

    while (cursor <= base.recurrenciaFin) {
      const fechaInicio = new Date(cursor);
      const fechaFin = duracionMs > 0 ? new Date(cursor.getTime() + duracionMs) : null;

      instancias.push({
        title: base.title,
        description: base.description,
        address: base.address,
        location: base.location,
        fechaInicio,
        fechaFin,
        precio: base.precio,
        precioMin: base.precioMin,
        precioMax: base.precioMax,
        privado: base.privado,
        linkAcceso: base.privado ? uuidv4() : null,
        categoria: base.categoria,
        estado: base.estado,
        creador: base.creador,
        imagen: base.imagen,
        imagenes: base.imagenes,
        recurrencia: base.recurrencia,
        recurrenciaFin: base.recurrenciaFin,
      });

      cursor.setDate(cursor.getDate() + intervaloDias);
    }

    return instancias;
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);
    const wasPrivado = event.privado;
    const willBePrivado = dto.privado !== undefined ? dto.privado : event.privado;

    this.applyEventUpdates(event, dto);
    event.privado = willBePrivado;
    event.asistentes = event.asistentes ?? [];

    const visibilityState = this.resolveVisibilityState(
      wasPrivado,
      willBePrivado,
      event.linkAcceso ?? null
    );
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
      const normalized = parseEventImages(dto.imagenes);
      event.imagenes = normalized.length > 0 ? normalized : undefined;
    }

    event.fechaInicio =
      dto.fechaInicio !== undefined ? this.parseOptionalDate(dto.fechaInicio) : event.fechaInicio;
    event.fechaFin =
      dto.fechaFin !== undefined ? this.parseOptionalDate(dto.fechaFin) : event.fechaFin;
    if (dto.recurrencia !== undefined) event.recurrencia = dto.recurrencia ?? null;
    if (dto.recurrenciaFin !== undefined)
      event.recurrenciaFin = dto.recurrenciaFin ? new Date(dto.recurrenciaFin) : null;
  }

  private resolveVisibilityState(
    wasPrivado: boolean | null | undefined,
    willBePrivado: boolean | null | undefined,
    currentLinkAcceso: string | null
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
    if (!event.asistentes.some((att) => att.id === userId)) {
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
        'id',
        'title',
        'description',
        'address',
        'location',
        'fechaInicio',
        'fechaFin',
        'precio',
        'linkAcceso',
        'precioMin',
        'precioMax',
        'privado',
        'categoria',
        'estado',
        'creador',
        'imagen',
        'imagenes',
        'asistentes',
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
    const events = await this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.categoria', 'categoria')
      .leftJoinAndSelect('event.creador', 'creador')
      .where('event.creador = :userId', { userId })
      .andWhere('event.estado != :pendiente', { pendiente: EstadoEnum.Pendiente })
      .orderBy('event.fechaInicio', 'DESC')
      .getMany();
    return this.processEventArray(events);
  }

  async findEventsToModerate(): Promise<Event[]> {
    const events = await this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.categoria', 'categoria')
      .leftJoinAndSelect('event.creador', 'creador')
      .where('event.privado = false AND event.estado = :pendiente', {
        pendiente: EstadoEnum.Pendiente,
      })
      .orderBy('event.fechaInicio', 'DESC')
      .getMany();
    return this.processEventArray(events);
  }

  async getEventReviews(eventId: string): Promise<Resena[]> {
    const reviews = await this.resenaRepo.find({
      where: { evento: { id: eventId } },
      relations: ['autor'],
      order: { fecha: 'DESC' },
    });
    return reviews;
  }
}
