import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';
import { Resena } from '../entities/resena.entity';
import { Recomendacion } from '../entities/recomendacion.entity';
import { EstadoEnum } from '../enums/estado.enum';
import { RateEventDto } from './dto/rate-event.dto';

type RecommendOptions = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  from?: string;
  to?: string;
  limit?: number;
  routesLimit?: number;
  minEventsPerRoute?: number;
  maxEventsPerRoute?: number;
  strategy?: 'balanced' | 'walkable' | 'score';
  maxGapMinutes?: number;
  maxOverlapMinutes?: number;
};

type ScoredEvent = {
  event: Event;
  score: number;
  distanceKm: number | null;
  reasons: string[];
};

type UserPoint = [number, number] | null;

type RecommendationWeights = {
  categoryInterest: number;
  categoryAttend: number;
  categorySave: number;
  categoryShare: number;
  categoryVisit: number;
  categoryRatedHigh: number;
  categoryRatedNeutral: number;
  categoryRatedLow: number;
  maxCategoryContribution: number;
  savedEvent: number;
  sharedEvent: number;
  attendingEvent: number;
  visitedEvent: number;
  myRatingFactor: number;
  globalRatingFactor: number;
  attendeesFactor: number;
  maxAttendeesBoost: number;
  maxDateBoost: number;
  daysDecayFactor: number;
  maxDistanceBoost: number;
  distanceDecayFactor: number;
};

@Injectable()
export class RecomendacionesService {
  private readonly weights: RecommendationWeights = {
    categoryInterest: this.getWeight('RECO_WEIGHT_CATEGORY_INTEREST', 5),
    categoryAttend: this.getWeight('RECO_WEIGHT_CATEGORY_ATTEND', 4),
    categorySave: this.getWeight('RECO_WEIGHT_CATEGORY_SAVE', 3),
    categoryShare: this.getWeight('RECO_WEIGHT_CATEGORY_SHARE', 3),
    categoryVisit: this.getWeight('RECO_WEIGHT_CATEGORY_VISIT', 3),
    categoryRatedHigh: this.getWeight('RECO_WEIGHT_CATEGORY_RATED_HIGH', 4),
    categoryRatedNeutral: this.getWeight('RECO_WEIGHT_CATEGORY_RATED_NEUTRAL', 1),
    categoryRatedLow: this.getWeight('RECO_WEIGHT_CATEGORY_RATED_LOW', -2),
    maxCategoryContribution: this.getWeight('RECO_WEIGHT_MAX_CATEGORY_CONTRIBUTION', 12),
    savedEvent: this.getWeight('RECO_WEIGHT_SAVED_EVENT', 10),
    sharedEvent: this.getWeight('RECO_WEIGHT_SHARED_EVENT', 8),
    attendingEvent: this.getWeight('RECO_WEIGHT_ATTENDING_EVENT', 6),
    visitedEvent: this.getWeight('RECO_WEIGHT_VISITED_EVENT', 4),
    myRatingFactor: this.getWeight('RECO_WEIGHT_MY_RATING_FACTOR', 2),
    globalRatingFactor: this.getWeight('RECO_WEIGHT_GLOBAL_RATING_FACTOR', 1.5),
    attendeesFactor: this.getWeight('RECO_WEIGHT_ATTENDEES_FACTOR', 5),
    maxAttendeesBoost: this.getWeight('RECO_WEIGHT_MAX_ATTENDEES_BOOST', 3),
    maxDateBoost: this.getWeight('RECO_WEIGHT_MAX_DATE_BOOST', 8),
    daysDecayFactor: this.getWeight('RECO_WEIGHT_DAYS_DECAY_FACTOR', 3),
    maxDistanceBoost: this.getWeight('RECO_WEIGHT_MAX_DISTANCE_BOOST', 6),
    distanceDecayFactor: this.getWeight('RECO_WEIGHT_DISTANCE_DECAY_FACTOR', 2),
  };

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(Resena)
    private readonly resenaRepo: Repository<Resena>,
    @InjectRepository(Recomendacion)
    private readonly recomendacionRepo: Repository<Recomendacion>,
  ) {}

  async saveEvent(userId: string, eventId: string) {
    const { user, event } = await this.getUserAndEvent(userId, eventId);
    user.eventosGuardados = this.pushUniqueEvent(user.eventosGuardados, event);
    await this.userRepo.save(user);
    return { ok: true, action: 'guardado', eventId };
  }

  async unsaveEvent(userId: string, eventId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['eventosGuardados'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    user.eventosGuardados = (user.eventosGuardados ?? []).filter((event) => event.id !== eventId);
    await this.userRepo.save(user);
    return { ok: true, action: 'eliminado_guardado', eventId };
  }

  async getSavedEvents(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['eventosGuardados', 'eventosGuardados.categoria', 'eventosGuardados.creador'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const events = (user.eventosGuardados ?? [])
      .sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime())
      .map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        fechaInicio: event.fechaInicio,
        fechaFin: event.fechaFin,
        address: event.address,
        categoria: event.categoria?.nombre ?? null,
        imagen: event.imagen ?? null,
        location: event.location ?? null,
      }));

    return {
      total: events.length,
      eventos: events,
    };
  }

  async shareEvent(userId: string, eventId: string) {
    const { user, event } = await this.getUserAndEvent(userId, eventId);
    user.eventosCompartidos = this.pushUniqueEvent(user.eventosCompartidos, event);
    await this.userRepo.save(user);
    return { ok: true, action: 'compartido', eventId };
  }

  async visitEvent(userId: string, eventId: string) {
    const { user, event } = await this.getUserAndEvent(userId, eventId);
    user.eventosVisitados = this.pushUniqueEvent(user.eventosVisitados, event);
    await this.userRepo.save(user);
    return { ok: true, action: 'visitado', eventId };
  }

  async rateEvent(userId: string, eventId: string, dto: RateEventDto) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');

    let resena = await this.resenaRepo.findOne({
      where: {
        autor: { id: userId },
        evento: { id: eventId },
      },
      relations: ['autor', 'evento'],
    });

    if (!resena) {
      resena = this.resenaRepo.create({
        autor: { id: userId } as User,
        evento: { id: eventId } as Event,
        puntuacion: dto.puntuacion,
        comentario: dto.comentario,
        fecha: new Date(),
      });
    } else {
      resena.puntuacion = dto.puntuacion;
      resena.comentario = dto.comentario;
      resena.fecha = new Date();
    }

    const saved = await this.resenaRepo.save(resena);
    return { ok: true, action: 'valorado', resenaId: saved.id };
  }

  async recommendEvents(userId: string, options: RecommendOptions = {}) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: [
        'eventosAsistidos',
        'eventosGuardados',
        'eventosCompartidos',
        'eventosVisitados',
        'eventosAsistidos.categoria',
        'eventosGuardados.categoria',
        'eventosCompartidos.categoria',
        'eventosVisitados.categoria',
      ],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const fromDate = options.from ? new Date(options.from) : new Date();
    const toDate = options.to ? new Date(options.to) : null;
    const radiusKm = Number.isFinite(options.radiusKm) ? Number(options.radiusKm) : 12;
    const limit = Number.isFinite(options.limit) ? Number(options.limit) : 20;

    const query = this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.categoria', 'categoria')
      .leftJoinAndSelect('event.creador', 'creador')
      .leftJoinAndSelect('event.asistentes', 'asistentes')
      .where('event.privado = false')
      .andWhere('event.estado = :estado', { estado: EstadoEnum.Aprobado })
      .andWhere('event.fechaFin >= :fromDate', { fromDate });

    if (toDate) {
      query.andWhere('event.fechaInicio <= :toDate', { toDate });
    }

    const [events, userResenas, eventRatingsRaw] = await Promise.all([
      query.getMany(),
      this.resenaRepo.find({
        where: { autor: { id: userId } },
        relations: ['evento', 'evento.categoria'],
      }),
      this.resenaRepo
        .createQueryBuilder('r')
        .select('r.eventoId', 'eventoId')
        .addSelect('AVG(r.puntuacion)', 'avgScore')
        .groupBy('r.eventoId')
        .getRawMany<{ eventoId: string; avgScore: string }>(),
    ]);

    const userPoint = this.resolveUserPoint(user, options);
    const preferenceByCategory = this.buildCategoryPreferences(user, userResenas);
    const ratingsByEvent = new Map(eventRatingsRaw.map((row) => [row.eventoId, Number(row.avgScore)]));

    const attendedIds = new Set((user.eventosAsistidos ?? []).map((e) => e.id));
    const visitedIds = new Set((user.eventosVisitados ?? []).map((e) => e.id));
    const savedIds = new Set((user.eventosGuardados ?? []).map((e) => e.id));
    const sharedIds = new Set((user.eventosCompartidos ?? []).map((e) => e.id));
    const ratedMap = new Map(userResenas.map((r) => [r.evento?.id, r.puntuacion]));

    const scored: ScoredEvent[] = [];

    for (const event of events) {
      const eventPoint = this.eventPoint(event);
      const distanceKm = userPoint && eventPoint ? this.haversineKm(userPoint, eventPoint) : null;
      if (distanceKm !== null && distanceKm > radiusKm) {
        continue;
      }

      let score = 0;
      const reasons: string[] = [];

      const categoryName = event.categoria?.nombre
        ? this.normalizeText(event.categoria.nombre)
        : undefined;
      const categoryScore = categoryName ? preferenceByCategory.get(categoryName) ?? 0 : 0;
      if (categoryScore > 0) {
        score += Math.min(categoryScore, this.weights.maxCategoryContribution);
        reasons.push('Coincide con tus intereses e historial de categorias');
      }

      if (savedIds.has(event.id)) {
        score += this.weights.savedEvent;
        reasons.push('Lo guardaste previamente');
      }
      if (sharedIds.has(event.id)) {
        score += this.weights.sharedEvent;
        reasons.push('Ya lo compartiste');
      }
      if (attendedIds.has(event.id)) {
        score += this.weights.attendingEvent;
        reasons.push('Estas apuntado');
      }
      if (visitedIds.has(event.id)) {
        score += this.weights.visitedEvent;
        reasons.push('Lo visitaste antes');
      }

      const myRating = ratedMap.get(event.id);
      if (myRating !== undefined) {
        score += (myRating - 3) * this.weights.myRatingFactor;
        reasons.push('Tu valoracion previa influye');
      }

      const avgRating = ratingsByEvent.get(event.id);
      if (avgRating !== undefined && Number.isFinite(avgRating)) {
        score += Math.max(0, avgRating - 3) * this.weights.globalRatingFactor;
        reasons.push('Bien valorado por la comunidad');
      }

      const asistentesScore = Math.min(
        (event.asistentes?.length ?? 0) / this.weights.attendeesFactor,
        this.weights.maxAttendeesBoost,
      );
      score += asistentesScore;

      const now = Date.now();
      const daysUntil = (new Date(event.fechaInicio).getTime() - now) / (1000 * 60 * 60 * 24);
      if (daysUntil >= 0) {
        const dateBoost = Math.max(
          0,
          this.weights.maxDateBoost - daysUntil / this.weights.daysDecayFactor,
        );
        score += dateBoost;
        if (dateBoost > 0) reasons.push('Fecha cercana');
      }

      if (distanceKm !== null) {
        const distanceBoost = Math.max(
          0,
          this.weights.maxDistanceBoost - distanceKm / this.weights.distanceDecayFactor,
        );
        score += distanceBoost;
        if (distanceBoost > 0) reasons.push('Cerca de tu ubicacion');
      }

      scored.push({
        event,
        score: Number(score.toFixed(3)),
        distanceKm,
        reasons: Array.from(new Set(reasons)).slice(0, 3),
      });
    }

    scored.sort((a, b) => b.score - a.score);

    const top = scored.slice(0, limit);
    await this.storeSnapshot(user, top);

    return {
      total: top.length,
      criterios: [
        'intereses-perfil',
        'eventos-guardados',
        'eventos-compartidos',
        'eventos-visitados',
        'eventos-apuntados',
        'valoraciones',
        'distancia',
        'fecha',
      ],
      eventos: top.map((item) => ({
        id: item.event.id,
        title: item.event.title,
        description: item.event.description,
        fechaInicio: item.event.fechaInicio,
        fechaFin: item.event.fechaFin,
        address: item.event.address,
        categoria: item.event.categoria?.nombre ?? null,
        imagen: item.event.imagen ?? null,
        location: item.event.location ?? null,
        score: item.score,
        distanceKm: item.distanceKm,
        reasons: item.reasons,
      })),
    };
  }

  async recommendRoutes(userId: string, options: RecommendOptions = {}) {
    const strategy = options.strategy ?? 'balanced';
    const routesLimit = Math.max(1, Math.min(10, Number(options.routesLimit ?? 3)));
    const minEventsPerRoute = Math.max(2, Math.min(6, Number(options.minEventsPerRoute ?? 3)));
    const maxEventsPerRoute = Math.max(
      minEventsPerRoute,
      Math.min(8, Number(options.maxEventsPerRoute ?? 5)),
    );
    const maxGapMinutes = Math.max(30, Math.min(24 * 60, Number(options.maxGapMinutes ?? 6 * 60)));
    const maxOverlapMinutes = Math.max(0, Math.min(120, Number(options.maxOverlapMinutes ?? 20)));

    const eventResult = await this.recommendEvents(userId, {
      ...options,
      limit: Math.max(Number(options.limit ?? 24), 12),
    });

    const fromDate = options.from ? new Date(options.from) : new Date();
    const toDate = options.to ? new Date(options.to) : null;

    const grouped = new Map<string, typeof eventResult.eventos>();

    for (const event of eventResult.eventos) {
      const fecha = new Date(event.fechaInicio);
      if (isNaN(fecha.getTime())) continue;
      if (fecha < fromDate) continue;
      if (toDate && fecha > toDate) continue;

      const dayKey = fecha.toISOString().slice(0, 10);
      grouped.set(dayKey, [...(grouped.get(dayKey) ?? []), event]);
    }

    const routes = Array.from(grouped.entries())
      .map(([day, events]) => {
        const orderedByDay = [...events]
          .sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime())
          .slice(0, maxEventsPerRoute);

        const ordered = this.extendRouteWithNearbyEvents(
          orderedByDay,
          eventResult.eventos,
          maxEventsPerRoute,
          minEventsPerRoute,
          day,
        );

        const sequenced = this.optimizeRouteSequence(
          ordered,
          eventResult.eventos,
          strategy,
          maxGapMinutes,
          maxOverlapMinutes,
        );

        if (sequenced.length < 2) return null;

        const points = sequenced
          .map((event) => {
            const original = this.eventPointFromResult(eventResult.eventos, event.id);
            return original ? { type: 'Point' as const, coordinates: original } : null;
          })
          .filter((point): point is { type: 'Point'; coordinates: [number, number] } => point !== null);

        if (points.length < 2) return null;

        const firstStart = new Date(sequenced[0].fechaInicio).getTime();
        const lastEnd = new Date(sequenced[sequenced.length - 1].fechaFin).getTime();
        const temporizacion = Math.max(30, Math.round((lastEnd - firstStart) / (1000 * 60)));

        const scoreMedio = Number(
          (
            sequenced.reduce((acc, current) => acc + Number(current.score), 0) /
            sequenced.length
          ).toFixed(3),
        );
        const distanceTotalKm = Number(this.totalDistance(points).toFixed(2));

        return {
          day,
          scoreMedio,
          temporizacionMinutos: temporizacion,
          distanceTotalKm,
          eventos: sequenced,
          trayecto: points,
          ranking: this.computeRouteRanking(
            scoreMedio,
            distanceTotalKm,
            temporizacion,
            strategy,
          ),
          quality: this.computeRouteQuality(sequenced, eventResult.eventos, strategy),
        };
      })
      .filter((route): route is NonNullable<typeof route> => route !== null)
      .sort((a, b) => b.ranking - a.ranking)
      .slice(0, routesLimit)
      .map(({ ranking: _ranking, ...route }) => route);

    return {
      total: routes.length,
      rutas: routes,
    };
  }

  private async getUserAndEvent(userId: string, eventId: string) {
    const [user, event] = await Promise.all([
      this.userRepo.findOne({
        where: { id: userId },
        relations: ['eventosGuardados', 'eventosCompartidos', 'eventosVisitados'],
      }),
      this.eventRepo.findOne({ where: { id: eventId } }),
    ]);

    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!event) throw new NotFoundException('Evento no encontrado');

    return { user, event };
  }

  private pushUniqueEvent(events: Event[] | undefined, event: Event): Event[] {
    const list = events ?? [];
    if (list.some((current) => current.id === event.id)) return list;
    return [...list, event];
  }

  private resolveUserPoint(user: User, options: RecommendOptions): UserPoint {
    if (Number.isFinite(options.lat) && Number.isFinite(options.lng)) {
      return [Number(options.lng), Number(options.lat)];
    }

    const coordinates = user.ubicacion?.coordinates;
    if (!coordinates || coordinates.length !== 2) return null;
    return [Number(coordinates[0]), Number(coordinates[1])];
  }

  private buildCategoryPreferences(user: User, userResenas: Resena[]): Map<string, number> {
    const map = new Map<string, number>();

    const add = (categoryName: string | undefined, weight: number) => {
      if (!categoryName) return;
      const key = this.normalizeText(categoryName);
      map.set(key, (map.get(key) ?? 0) + weight);
    };

    for (const interes of user.intereses ?? []) {
      add(interes, this.weights.categoryInterest);
    }
    for (const event of user.eventosAsistidos ?? []) {
      add(event.categoria?.nombre, this.weights.categoryAttend);
    }
    for (const event of user.eventosGuardados ?? []) {
      add(event.categoria?.nombre, this.weights.categorySave);
    }
    for (const event of user.eventosCompartidos ?? []) {
      add(event.categoria?.nombre, this.weights.categoryShare);
    }
    for (const event of user.eventosVisitados ?? []) {
      add(event.categoria?.nombre, this.weights.categoryVisit);
    }
    for (const resena of userResenas) {
      const weight =
        resena.puntuacion >= 4
          ? this.weights.categoryRatedHigh
          : resena.puntuacion === 3
            ? this.weights.categoryRatedNeutral
            : this.weights.categoryRatedLow;
      add(resena.evento?.categoria?.nombre, weight);
    }

    return map;
  }

  private eventPoint(event: Event): [number, number] | null {
    const coordinates = event.location?.coordinates;
    if (!coordinates || coordinates.length !== 2) return null;
    return [Number(coordinates[0]), Number(coordinates[1])];
  }

  private eventPointFromResult(
    events: Array<{ id: string; location?: { coordinates?: [number, number] } | null }>,
    eventId: string,
  ): [number, number] | null {
    const target = events.find((event) => event.id === eventId);
    if (!target) return null;

    const coordinates = target.location?.coordinates;
    if (!coordinates || coordinates.length !== 2) return null;
    return [Number(coordinates[0]), Number(coordinates[1])];
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  private haversineKm([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private totalDistance(points: Array<{ coordinates: [number, number] }>): number {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += this.haversineKm(points[i - 1].coordinates, points[i].coordinates);
    }
    return total;
  }

  private computeRouteRanking(
    scoreMedio: number,
    distanceTotalKm: number,
    temporizacionMinutos: number,
    strategy: 'balanced' | 'walkable' | 'score',
  ): number {
    if (strategy === 'walkable') {
      return scoreMedio * 1.1 - distanceTotalKm * 0.45 - temporizacionMinutos * 0.002;
    }
    if (strategy === 'score') {
      return scoreMedio * 1.4 - distanceTotalKm * 0.12 - temporizacionMinutos * 0.001;
    }
    return scoreMedio * 1.2 - distanceTotalKm * 0.25 - temporizacionMinutos * 0.0015;
  }

  private computeRouteQuality<
    T extends { id: string; fechaInicio: Date | string; fechaFin: Date | string }
  >(
    sequenced: T[],
    fullPool: Array<{ id: string; location?: { coordinates?: [number, number] } | null }>,
    strategy: 'balanced' | 'walkable' | 'score',
  ): number {
    if (sequenced.length < 2) return 0;

    let penalties = 0;

    for (let i = 1; i < sequenced.length; i++) {
      const prev = sequenced[i - 1];
      const next = sequenced[i];

      const prevEnd = new Date(prev.fechaFin).getTime();
      const nextStart = new Date(next.fechaInicio).getTime();
      const gapMin = (nextStart - prevEnd) / (1000 * 60);

      const prevPoint = this.eventPointFromResult(fullPool, prev.id);
      const nextPoint = this.eventPointFromResult(fullPool, next.id);
      const distanceKm = prevPoint && nextPoint ? this.haversineKm(prevPoint, nextPoint) : 2.5;

      const minTravel = this.estimateMinTravelMinutes(distanceKm, strategy);
      if (gapMin >= 0 && gapMin < minTravel) {
        penalties += (minTravel - gapMin) * 0.12;
      }
      if (gapMin < 0) {
        penalties += Math.abs(gapMin) * 0.08;
      }
      if (gapMin > 180) {
        penalties += (gapMin - 180) * 0.02;
      }
    }

    const quality = Math.max(0, 100 - penalties);
    return Number(quality.toFixed(2));
  }

  private extendRouteWithNearbyEvents<
    T extends { id: string; fechaInicio: Date | string; fechaFin: Date | string; score: number }
  >(
    baseEvents: T[],
    poolEvents: T[],
    maxEvents: number,
    minEvents: number,
    dayKey?: string,
  ): T[] {
    const selected = [...baseEvents].slice(0, maxEvents);
    const selectedIds = new Set(selected.map((event) => event.id));

    const fallbackAnchor = selected.length > 0
      ? new Date(selected[selected.length - 1].fechaInicio).getTime()
      : null;

    const nearbyCandidates = poolEvents
      .filter((event) => !selectedIds.has(event.id))
      .filter((event) => {
        if (!dayKey) return true;
        const eventDate = new Date(event.fechaInicio);
        if (isNaN(eventDate.getTime())) return false;
        return eventDate.toISOString().slice(0, 10) === dayKey;
      })
      .map((event) => {
        const start = new Date(event.fechaInicio).getTime();
        const distanceToAnchor =
          fallbackAnchor !== null && Number.isFinite(start)
            ? Math.abs(start - fallbackAnchor)
            : Number.MAX_SAFE_INTEGER;

        return { event, start, distanceToAnchor };
      })
      .filter((candidate) => Number.isFinite(candidate.start))
      .sort((a, b) => {
        if (a.distanceToAnchor !== b.distanceToAnchor) {
          return a.distanceToAnchor - b.distanceToAnchor;
        }
        return b.event.score - a.event.score;
      });

    for (const candidate of nearbyCandidates) {
      if (selected.length >= maxEvents) break;
      selected.push(candidate.event);
      selectedIds.add(candidate.event.id);
    }

    if (selected.length < minEvents) {
      const topScored = poolEvents
        .filter((event) => !selectedIds.has(event.id))
        .filter((event) => {
          if (!dayKey) return true;
          const eventDate = new Date(event.fechaInicio);
          if (isNaN(eventDate.getTime())) return false;
          return eventDate.toISOString().slice(0, 10) === dayKey;
        })
        .sort((a, b) => b.score - a.score);

      for (const event of topScored) {
        if (selected.length >= Math.min(minEvents, maxEvents)) break;
        selected.push(event);
        selectedIds.add(event.id);
      }
    }

    return selected
      .sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime())
      .slice(0, maxEvents);
  }

  private optimizeRouteSequence<
    T extends { id: string; fechaInicio: Date | string; fechaFin: Date | string; score: number }
  >(
    events: T[],
    fullPool: Array<{ id: string; location?: { coordinates?: [number, number] } | null }>,
    strategy: 'balanced' | 'walkable' | 'score',
    maxAllowedGapMin: number,
    maxAllowedOverlapMin: number,
  ): T[] {
    if (events.length <= 2) {
      return [...events].sort(
        (a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime(),
      );
    }

    const scoreWeight = strategy === 'score' ? 1.5 : strategy === 'walkable' ? 0.8 : 1.1;
    const distanceWeight = strategy === 'walkable' ? 0.9 : strategy === 'score' ? 0.2 : 0.45;
    const timeWeight = strategy === 'score' ? 0.35 : strategy === 'walkable' ? 0.6 : 0.5;
    const remaining = [...events];
    const sequenced: T[] = [];

    const initialIndex = remaining
      .map((event, index) => ({ index, start: new Date(event.fechaInicio).getTime() }))
      .filter((item) => Number.isFinite(item.start))
      .sort((a, b) => a.start - b.start)[0]?.index;

    const first = remaining.splice(initialIndex ?? 0, 1)[0];
    sequenced.push(first);

    while (remaining.length > 0) {
      const current = sequenced[sequenced.length - 1];
      const currentStart = new Date(current.fechaInicio).getTime();
      const currentEnd = new Date(current.fechaFin).getTime();
      const currentPoint = this.eventPointFromResult(fullPool, current.id);

      const candidateIndexes = remaining
        .map((event, index) => ({ index, start: new Date(event.fechaInicio).getTime() }))
        .filter((item) => Number.isFinite(item.start) && item.start >= currentStart)
        .map((item) => item.index);

      const indexesToRank = candidateIndexes.length > 0
        ? candidateIndexes
        : remaining.map((_, index) => index);

      let bestIndex = indexesToRank[0];
      let bestValue = Number.NEGATIVE_INFINITY;

      for (const index of indexesToRank) {
        const candidate = remaining[index];
        const candidateStart = new Date(candidate.fechaInicio).getTime();
        const candidateEnd = new Date(candidate.fechaFin).getTime();

        const candidatePoint = this.eventPointFromResult(fullPool, candidate.id);
        const distanceKm =
          currentPoint && candidatePoint
            ? this.haversineKm(currentPoint, candidatePoint)
            : 2.5;

        const gapMin = (candidateStart - currentEnd) / (1000 * 60);
        if (gapMin > maxAllowedGapMin) {
          continue;
        }
        if (gapMin < -maxAllowedOverlapMin) {
          continue;
        }

        const minTravelMinutes = this.estimateMinTravelMinutes(distanceKm, strategy);
        if (gapMin >= 0 && gapMin < minTravelMinutes) {
          continue;
        }

        const overlapPenalty = gapMin < 0 ? Math.min(6, Math.abs(gapMin) * 0.06) : 0;
        const waitPenalty = gapMin > 240 ? (gapMin - 240) * 0.008 : 0;
        const reverseTimePenalty = candidateStart < currentStart ? 4 : 0;
        const invalidDatePenalty = Number.isFinite(candidateStart) && Number.isFinite(candidateEnd) ? 0 : 5;
        const travelFeasibilityPenalty =
          gapMin >= 0 ? Math.max(0, minTravelMinutes - gapMin) * 0.04 : 0;

        const value =
          Number(candidate.score) * scoreWeight -
          distanceKm * distanceWeight -
          (overlapPenalty + waitPenalty + reverseTimePenalty + travelFeasibilityPenalty) * timeWeight -
          invalidDatePenalty;

        if (value > bestValue) {
          bestValue = value;
          bestIndex = index;
        }
      }

      if (!Number.isFinite(bestValue) || bestValue === Number.NEGATIVE_INFINITY) {
        break;
      }

      const [next] = remaining.splice(bestIndex, 1);
      sequenced.push(next);
    }

    return sequenced;
  }

  private estimateMinTravelMinutes(
    distanceKm: number,
    strategy: 'balanced' | 'walkable' | 'score',
  ): number {
    const speedKmH = strategy === 'walkable' ? 5 : strategy === 'score' ? 26 : 18;
    const base = (distanceKm / speedKmH) * 60;
    const transferBuffer = strategy === 'walkable' ? 4 : 8;
    return Math.max(2, Math.round(base + transferBuffer));
  }

  private async storeSnapshot(user: User, top: ScoredEvent[]) {
    if (top.length === 0) return;

    let snapshot = await this.recomendacionRepo.findOne({
      where: { usuario: { id: user.id } },
      relations: ['usuario'],
    });

    if (!snapshot) {
      snapshot = this.recomendacionRepo.create({
        usuario: user,
        eventosRecomendados: top.map((item) => item.event),
        criterios: ['intereses', 'historial', 'distancia', 'fecha', 'valoraciones'],
        vista: false,
      });
    } else {
      snapshot.eventosRecomendados = top.map((item) => item.event);
      snapshot.criterios = ['intereses', 'historial', 'distancia', 'fecha', 'valoraciones'];
      snapshot.vista = false;
    }

    await this.recomendacionRepo.save(snapshot);
  }

  private getWeight(envName: string, fallback: number): number {
    const rawValue = process.env[envName];
    if (!rawValue) return fallback;

    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
