import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, DataSource } from 'typeorm';
import { User } from '../users/user.entity';
import { Event } from '../events/event.entity';
import { Resena } from '../events/resena.entity';
import { Recomendacion } from './recomendacion.entity';
import { EstadoEnum } from '../events/enums/estado.enum';
import { RateEventDto } from './dto/rate-event.dto';
import { getSevillaDayKey } from '../common/sevilla-time';
import { haversineDistanceKm } from '../common/distance.util';

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

type EventLocation = {
  type?: string;
  coordinates?: [number, number] | number[];
} | null;

type RecommendedEventItem = {
  id: string;
  title: string;
  description: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  hasMultipleDatesAvailable: boolean;
  address: string;
  categoria: string | null;
  imagen: string | null;
  location: EventLocation;
  score: number;
  distanceKm: number;
  reasons: string[];
};

type RecommendedEventWithDates = RecommendedEventItem & {
  fechaInicio: Date | string;
  fechaFin: Date | string;
};

type RouteCandidate = {
  day: string;
  scoreMedio: number;
  temporizacionMinutos: number;
  distanceTotalKm: number;
  eventos: RecommendedEventItem[];
  trayecto: Array<{ type: 'Point'; coordinates: [number, number] }>;
  ranking: number;
  quality: number;
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
    private readonly dataSource: DataSource
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
      .sort((a, b) => {
        const aTime = a.fechaInicio ? new Date(a.fechaInicio).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.fechaInicio ? new Date(b.fechaInicio).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        fechaInicio: event.fechaInicio,
        fechaFin: event.fechaFin,
        hasMultipleDatesAvailable: event.hasMultipleDatesAvailable ?? false,
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
    const comentario = dto.comentario?.trim() ?? '';

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
        comentario,
        fecha: new Date(),
      });
    } else {
      resena.puntuacion = dto.puntuacion;
      resena.comentario = comentario;
      resena.fecha = new Date();
    }

    const saved = await this.resenaRepo.save(resena);
    return { ok: true, action: 'valorado', resenaId: saved.id };
  }

  async getMyEventRating(userId: string, eventId: string) {
    const resena = await this.resenaRepo.findOne({
      where: {
        autor: { id: userId },
        evento: { id: eventId },
      },
      relations: ['evento'],
    });

    if (!resena) {
      return {
        hasRating: false,
        puntuacion: null,
        comentario: '',
        fecha: null,
      };
    }

    return {
      hasRating: true,
      puntuacion: resena.puntuacion,
      comentario: resena.comentario ?? '',
      fecha: resena.fecha,
    };
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
    const radiusKm = this.clampNumber(options.radiusKm, 12, 1, 200);
    const limit = this.clampNumber(options.limit, 20, 1, 100);

    const query = this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.categoria', 'categoria')
      .leftJoinAndSelect('event.creador', 'creador')
      .leftJoinAndSelect('event.asistentes', 'asistentes')
      .where('event.privado = false')
      .andWhere('event.estado = :estado', { estado: EstadoEnum.Aprobado })
      .andWhere(
        new Brackets((qb) => {
          qb.where('event.fechaFin >= :fromDate', { fromDate })
            .orWhere('event.hasMultipleDatesAvailable = true')
            .orWhere(
              '(event.fechaFin IS NULL AND event.fechaInicio IS NOT NULL AND event.fechaInicio >= :fromDate)',
              { fromDate }
            );
        })
      );

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
    const ratingsByEvent = new Map(
      eventRatingsRaw.map((row) => [row.eventoId, Number(row.avgScore)])
    );

    const attendedIds = new Set((user.eventosAsistidos ?? []).map((e) => e.id));
    const visitedIds = new Set((user.eventosVisitados ?? []).map((e) => e.id));
    const savedIds = new Set((user.eventosGuardados ?? []).map((e) => e.id));
    const sharedIds = new Set((user.eventosCompartidos ?? []).map((e) => e.id));
    const ratedMap = new Map(userResenas.map((r) => [r.evento?.id, r.puntuacion]));

    const scored: ScoredEvent[] = [];

    for (const event of events) {
      const eventPoint = this.eventPointFromLocationField(event);
      const distanceKm = userPoint && eventPoint ? this.haversineKm(userPoint, eventPoint) : null;
      if (distanceKm !== null && distanceKm > radiusKm) {
        continue;
      }

      let score = 0;
      const reasons: string[] = [];

      const categoryName = event.categoria?.nombre
        ? this.normalizeText(event.categoria.nombre)
        : undefined;
      const categoryScore = categoryName ? (preferenceByCategory.get(categoryName) ?? 0) : 0;
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
        reasons.push('Estás apuntado');
      }
      if (visitedIds.has(event.id)) {
        score += this.weights.visitedEvent;
        reasons.push('Lo visitaste antes');
      }

      const myRating = ratedMap.get(event.id);
      if (myRating !== undefined) {
        score += (myRating - 3) * this.weights.myRatingFactor;
        reasons.push('Tu valoración previa influye');
      }

      const avgRating = ratingsByEvent.get(event.id);
      if (avgRating !== undefined && Number.isFinite(avgRating)) {
        score += Math.max(0, avgRating - 3) * this.weights.globalRatingFactor;
        reasons.push('Bien valorado por la comunidad');
      }

      const asistentesScore = Math.min(
        (event.asistentes?.length ?? 0) / this.weights.attendeesFactor,
        this.weights.maxAttendeesBoost
      );
      score += asistentesScore;

      const hasFlexibleDates = this.hasFlexibleDates(event);

      const startDate = event.fechaInicio ? new Date(event.fechaInicio) : null;
      if (startDate && Number.isFinite(startDate.getTime())) {
        const now = Date.now();
        const daysUntil = (startDate.getTime() - now) / (1000 * 60 * 60 * 24);
        if (daysUntil >= 0) {
          const dateBoostBase = Math.max(
            0,
            this.weights.maxDateBoost - daysUntil / this.weights.daysDecayFactor
          );
          const dateBoost = hasFlexibleDates ? dateBoostBase * 0.2 : dateBoostBase;
          score += dateBoost;
          if (dateBoost > 0) {
            reasons.push(hasFlexibleDates ? 'Fecha flexible' : 'Fecha cercana');
          }
        }
      }

      if (distanceKm !== null) {
        const distanceBoostBase = Math.max(
          0,
          this.weights.maxDistanceBoost - distanceKm / this.weights.distanceDecayFactor
        );
        const distanceBoost = hasFlexibleDates ? distanceBoostBase * 1.35 : distanceBoostBase;
        score += distanceBoost;
        if (distanceBoost > 0) reasons.push('Cerca de tu ubicación');
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
        title: item.event.title ?? 'Evento sin título',
        description: item.event.description ?? '',
        fechaInicio: item.event.fechaInicio ?? null,
        fechaFin: item.event.fechaFin ?? null,
        hasMultipleDatesAvailable: item.event.hasMultipleDatesAvailable ?? false,
        address: item.event.address ?? '',
        categoria: item.event.categoria?.nombre ?? null,
        imagen: item.event.imagen ?? null,
        location: item.event.location ?? null,
        score: item.score,
        distanceKm: item.distanceKm ?? 0,
        reasons: item.reasons,
      })),
    };
  }

  async recommendRoutes(userId: string, options: RecommendOptions = {}) {
    const strategy = options.strategy ?? 'balanced';
    const routesLimit = this.clampNumber(options.routesLimit, 3, 1, 10);
    const minEventsPerRoute = this.clampNumber(options.minEventsPerRoute, 3, 2, 6);
    const maxEventsPerRoute = Math.max(
      minEventsPerRoute,
      this.clampNumber(options.maxEventsPerRoute, 5, minEventsPerRoute, 8)
    );
    const maxGapMinutes = this.clampNumber(options.maxGapMinutes, 4 * 60, 30, 4 * 60);
    const maxOverlapMinutes = this.clampNumber(options.maxOverlapMinutes, 20, 0, 120);

    const eventResult = await this.recommendEvents(userId, {
      ...options,
      limit: this.clampNumber(options.limit, 24, 12, 200),
    });

    const fromDate = options.from ? new Date(options.from) : new Date();
    const toDate = options.to ? new Date(options.to) : null;
    const userPoint =
      Number.isFinite(options.lat) && Number.isFinite(options.lng)
        ? ([Number(options.lng), Number(options.lat)] as [number, number])
        : null;

    const datedEvents: RecommendedEventWithDates[] = eventResult.eventos.filter((event) =>
      this.hasValidEventDates(event)
    );
    const routeBuckets = this.bucketRecommendedEventsByDay(eventResult.eventos, fromDate, toDate);
    const rankedRoutes = this.buildRankedRoutes({
      grouped: routeBuckets.grouped,
      allEvents: eventResult.eventos,
      datedEvents,
      strategy,
      maxGapMinutes,
      maxOverlapMinutes,
      minEventsPerRoute,
      maxEventsPerRoute,
    });

    const distanceRoutes = this.buildDistanceRoutes(
      routeBuckets.undatedEvents,
      userPoint,
      strategy,
      routesLimit,
      maxEventsPerRoute
    );

    const selectedRoutes = this.selectBestRoutes(rankedRoutes, distanceRoutes, routesLimit);
    const routes = selectedRoutes.map(({ ranking: _ranking, ...route }) => route);

    return {
      total: routes.length,
      rutas: routes,
    };
  }

  private hasValidEventDates<
    T extends {
      fechaInicio?: Date | string | null;
      fechaFin?: Date | string | null;
      hasMultipleDatesAvailable?: boolean | null;
    },
  >(event: T): event is T & { fechaInicio: Date | string; fechaFin: Date | string } {
    if (event.hasMultipleDatesAvailable) return false;
    if (!event.fechaInicio || !event.fechaFin) return false;
    const start = new Date(event.fechaInicio);
    const end = new Date(event.fechaFin);
    return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime());
  }

  private hasFlexibleDates(event: {
    fechaInicio?: Date | string | null;
    fechaFin?: Date | string | null;
    hasMultipleDatesAvailable?: boolean | null;
  }): boolean {
    if (event.hasMultipleDatesAvailable) return true;
    return !event.fechaInicio || !event.fechaFin;
  }

  private buildDistanceRoutes(
    events: RecommendedEventItem[],
    userPoint: UserPoint,
    strategy: 'balanced' | 'walkable' | 'score',
    routesLimit: number,
    maxEventsPerRoute: number
  ): RouteCandidate[] {
    const remaining = [...events];
    const routes: RouteCandidate[] = [];

    while (remaining.length > 0 && routes.length < routesLimit) {
      const routeEvents: RecommendedEventItem[] = [];

      const firstIndex =
        remaining
          .map((event, index) => ({
            index,
            score: Number(event.score ?? 0),
            point: this.eventPointFromResult(remaining, event.id),
          }))
          .sort((a, b) => {
            if (userPoint && a.point && b.point) {
              const aDistance = this.haversineKm(userPoint, a.point);
              const bDistance = this.haversineKm(userPoint, b.point);
              if (aDistance !== bDistance) return aDistance - bDistance;
            }
            return b.score - a.score;
          })[0]?.index ?? 0;

      const [seed] = remaining.splice(firstIndex, 1);
      if (!seed) break;
      routeEvents.push(seed);

      while (remaining.length > 0 && routeEvents.length < maxEventsPerRoute) {
        const current = routeEvents[routeEvents.length - 1];
        const currentPoint =
          this.eventPointFromResult(remaining, current.id) ??
          this.eventPointFromResult(routeEvents, current.id);

        let bestIndex = 0;
        let bestValue = Number.NEGATIVE_INFINITY;

        for (let index = 0; index < remaining.length; index++) {
          const candidate = remaining[index];
          const candidatePoint =
            this.eventPointFromResult(remaining, candidate.id) ??
            this.eventPointFromResult(routeEvents, candidate.id);
          const distanceKm =
            currentPoint && candidatePoint ? this.haversineKm(currentPoint, candidatePoint) : 2.5;
          const maxConsecutiveDistanceKm = strategy === 'walkable' ? 3 : 5;
          if (distanceKm > maxConsecutiveDistanceKm) continue;
          const value =
            Number(candidate.score ?? 0) * (strategy === 'score' ? 1.4 : 1.1) -
            distanceKm * (strategy === 'walkable' ? 0.35 : 0.25);

          if (value > bestValue) {
            bestValue = value;
            bestIndex = index;
          }
        }

        const [next] = remaining.splice(bestIndex, 1);
        if (!next) break;
        routeEvents.push(next);
      }

      if (routeEvents.length < 2) break;

      const points = routeEvents
        .map((event) => {
          const original = this.eventPointFromResult(events, event.id);
          return original ? { type: 'Point' as const, coordinates: original } : null;
        })
        .filter(
          (point): point is { type: 'Point'; coordinates: [number, number] } => point !== null
        );

      if (points.length < 2) continue;

      const scoreMedio = Number(
        (
          routeEvents.reduce((acc, current) => acc + Number(current.score ?? 0), 0) /
          routeEvents.length
        ).toFixed(3)
      );
      const distanceTotalKm = Number(this.totalDistance(points).toFixed(2));
      const temporizacionMinutos = Math.max(30, Math.round(distanceTotalKm * 12));

      routes.push({
        day: 'Sin fecha',
        scoreMedio,
        temporizacionMinutos,
        distanceTotalKm,
        eventos: routeEvents,
        trayecto: points,
        ranking: this.computeRouteRanking(
          scoreMedio,
          distanceTotalKm,
          temporizacionMinutos,
          strategy
        ),
        quality: Math.max(0, 100 - distanceTotalKm * 4),
      });
    }

    return routes;
  }

  private bucketRecommendedEventsByDay(
    events: RecommendedEventItem[],
    fromDate: Date,
    toDate: Date | null
  ): {
    grouped: Map<string, RecommendedEventWithDates[]>;
    undatedEvents: RecommendedEventItem[];
  } {
    const grouped = new Map<string, RecommendedEventWithDates[]>();
    const undatedEvents: RecommendedEventItem[] = [];

    for (const event of events) {
      if (!this.hasValidEventDates(event)) {
        undatedEvents.push(event);
        continue;
      }

      const startDate = new Date(event.fechaInicio);
      if (startDate < fromDate) continue;
      if (toDate && startDate > toDate) continue;

      const dayKey = getSevillaDayKey(startDate);
      grouped.set(dayKey, [...(grouped.get(dayKey) ?? []), event]);
    }

    return { grouped, undatedEvents };
  }

  private buildRankedRoutes(options: {
    grouped: Map<string, RecommendedEventWithDates[]>;
    allEvents: RecommendedEventItem[];
    datedEvents: RecommendedEventWithDates[];
    strategy: 'balanced' | 'walkable' | 'score';
    maxGapMinutes: number;
    maxOverlapMinutes: number;
    minEventsPerRoute: number;
    maxEventsPerRoute: number;
  }): RouteCandidate[] {
    return Array.from(options.grouped.entries())
      .map(([day, events]) => this.buildRouteForDay(day, events, options))
      .filter((route): route is RouteCandidate => route !== null)
      .sort((a, b) => {
        const rankingDiff = b.ranking - a.ranking;
        if (rankingDiff !== 0) return rankingDiff;
        return b.eventos.length - a.eventos.length;
      });
  }

  private buildRouteForDay(
    day: string,
    events: RecommendedEventWithDates[],
    options: {
      allEvents: RecommendedEventItem[];
      datedEvents: RecommendedEventWithDates[];
      strategy: 'balanced' | 'walkable' | 'score';
      maxGapMinutes: number;
      maxOverlapMinutes: number;
      minEventsPerRoute: number;
      maxEventsPerRoute: number;
    }
  ): RouteCandidate | null {
    const orderedByDay = [...events]
      .sort((left, right) => this.compareOptionalDates(left.fechaInicio, right.fechaInicio))
      .slice(0, options.maxEventsPerRoute);

    const ordered = this.extendRouteWithNearbyEvents(
      orderedByDay,
      options.datedEvents,
      options.maxEventsPerRoute,
      options.minEventsPerRoute,
      day
    );

    let sequenced = this.optimizeRouteSequence(
      ordered,
      options.allEvents,
      options.strategy,
      options.maxGapMinutes,
      options.maxOverlapMinutes
    );

    if (
      sequenced.length < options.minEventsPerRoute &&
      ordered.length >= options.minEventsPerRoute
    ) {
      const relaxedSequenced = this.optimizeRouteSequence(
        ordered,
        options.allEvents,
        options.strategy,
        4 * 60,
        120
      );
      if (relaxedSequenced.length > sequenced.length) {
        sequenced = relaxedSequenced;
      }
    }

    return this.buildRouteCandidate(day, sequenced, options.allEvents, options.strategy);
  }

  private buildRouteCandidate(
    day: string,
    sequenced: RecommendedEventWithDates[],
    allEvents: RecommendedEventItem[],
    strategy: 'balanced' | 'walkable' | 'score'
  ): RouteCandidate | null {
    if (sequenced.length < 2) return null;

    const points = sequenced
      .map((event) => {
        const original = this.eventPointFromResult(allEvents, event.id);
        return original ? { type: 'Point' as const, coordinates: original } : null;
      })
      .filter((point): point is { type: 'Point'; coordinates: [number, number] } => point !== null);

    if (points.length < 2) return null;

    const firstStart = this.toDateTime(sequenced[0].fechaInicio);
    const lastEnd = this.toDateTime(sequenced[sequenced.length - 1].fechaFin);
    if (firstStart === null || lastEnd === null) return null;

    const temporizacion = Math.max(30, Math.round((lastEnd - firstStart) / (1000 * 60)));
    const scoreMedio = Number(
      (
        sequenced.reduce((acc, current) => acc + Number(current.score), 0) / sequenced.length
      ).toFixed(3)
    );
    const distanceTotalKm = Number(this.totalDistance(points).toFixed(2));

    return {
      day,
      scoreMedio,
      temporizacionMinutos: temporizacion,
      distanceTotalKm,
      eventos: sequenced,
      trayecto: points,
      ranking: this.computeRouteRanking(scoreMedio, distanceTotalKm, temporizacion, strategy),
      quality: this.computeRouteQuality(sequenced, allEvents, strategy),
    };
  }

  private selectBestRoutes(
    rankedRoutes: RouteCandidate[],
    distanceRoutes: RouteCandidate[],
    routesLimit: number
  ): RouteCandidate[] {
    const combined = [...rankedRoutes, ...distanceRoutes]
      .sort((left, right) => {
        const rankingDiff = right.ranking - left.ranking;
        if (rankingDiff !== 0) return rankingDiff;
        return right.eventos.length - left.eventos.length;
      })
      .slice(0, routesLimit);

    if (combined.length === 0) return combined;

    const allAreTwoEvents = combined.every((route) => route.eventos.length === 2);
    if (!allAreTwoEvents) {
      return combined;
    }

    const longerAlternative = rankedRoutes.find((route) => route.eventos.length > 2);
    if (!longerAlternative) {
      return combined;
    }

    const withoutSameDay = combined.filter((route) => route.day !== longerAlternative.day);
    if (withoutSameDay.length >= routesLimit) {
      withoutSameDay[withoutSameDay.length - 1] = longerAlternative;
      return withoutSameDay;
    }

    return [...withoutSameDay, longerAlternative]
      .sort((left, right) => right.ranking - left.ranking)
      .slice(0, routesLimit);
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

  private eventPointFromLocationField(
    event: Event | Array<{ id: string; location?: EventLocation }>
  ): [number, number] | null {
    if (Array.isArray(event)) return null;
    const coordinates = (event as Event).location?.coordinates;
    if (!coordinates || coordinates.length !== 2) return null;
    return [Number(coordinates[0]), Number(coordinates[1])];
  }

  private eventPointFromResult(
    events: Array<{ id: string; location?: EventLocation }>,
    eventId: string
  ): [number, number] | null {
    const target = events.find((event) => event.id === eventId);
    if (!target) return null;
    return this.eventPointFromLocationField(target as unknown as Event);
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
    return haversineDistanceKm(lat1, lng1, lat2, lng2);
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
    strategy: 'balanced' | 'walkable' | 'score'
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
    T extends { id: string; fechaInicio: Date | string; fechaFin: Date | string },
  >(
    sequenced: T[],
    fullPool: Array<{ id: string; location?: EventLocation }>,
    strategy: 'balanced' | 'walkable' | 'score'
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
    T extends { id: string; fechaInicio: Date | string; fechaFin: Date | string; score: number },
  >(baseEvents: T[], poolEvents: T[], maxEvents: number, minEvents: number, dayKey?: string): T[] {
    const selected = [...baseEvents].slice(0, maxEvents);
    const selectedIds = new Set(selected.map((event) => event.id));

    const fallbackAnchor =
      selected.length > 0 ? new Date(selected[selected.length - 1].fechaInicio).getTime() : null;

    const nearbyCandidates = poolEvents
      .filter((event) => !selectedIds.has(event.id))
      .filter((event) => {
        if (!dayKey) return true;
        const eventDate = new Date(event.fechaInicio);
        if (isNaN(eventDate.getTime())) return false;
        return getSevillaDayKey(eventDate) === dayKey;
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

    if (selected.length < minEvents && dayKey) {
      const crossDayNearby = poolEvents
        .filter((event) => !selectedIds.has(event.id))
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

      for (const candidate of crossDayNearby) {
        if (selected.length >= Math.min(minEvents, maxEvents)) break;
        selected.push(candidate.event);
        selectedIds.add(candidate.event.id);
      }
    }

    if (selected.length < minEvents) {
      const topScored = poolEvents
        .filter((event) => !selectedIds.has(event.id))
        .filter((event) => {
          if (!dayKey) return true;
          const eventDate = new Date(event.fechaInicio);
          if (isNaN(eventDate.getTime())) return false;
          return getSevillaDayKey(eventDate) === dayKey;
        })
        .sort((a, b) => b.score - a.score);

      const topScoredCrossDay = poolEvents
        .filter((event) => !selectedIds.has(event.id))
        .sort((a, b) => b.score - a.score);

      for (const event of topScored) {
        if (selected.length >= Math.min(minEvents, maxEvents)) break;
        selected.push(event);
        selectedIds.add(event.id);
      }

      for (const event of topScoredCrossDay) {
        if (selected.length >= Math.min(minEvents, maxEvents)) break;
        selected.push(event);
        selectedIds.add(event.id);
      }
    }

    return selected.slice(0, maxEvents);
  }

  private optimizeRouteSequence<
    T extends { id: string; fechaInicio: Date | string; fechaFin: Date | string; score: number },
  >(
    events: T[],
    fullPool: Array<{ id: string; location?: EventLocation }>,
    strategy: 'balanced' | 'walkable' | 'score',
    maxAllowedGapMin: number,
    maxAllowedOverlapMin: number
  ): T[] {
    if (events.length <= 2) {
      return [...events].sort(
        (a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime()
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
      const effectiveCurrentEnd = this.getEffectiveEventEndTime(currentStart, currentEnd);
      const currentPoint = this.eventPointFromResult(fullPool, current.id);

      const candidateIndexes = remaining
        .map((event, index) => ({ index, start: new Date(event.fechaInicio).getTime() }))
        .filter((item) => Number.isFinite(item.start) && item.start >= currentStart)
        .map((item) => item.index);

      if (candidateIndexes.length === 0) {
        break;
      }

      const indexesToRank = candidateIndexes;

      let bestIndex = indexesToRank[0];
      let bestValue = Number.NEGATIVE_INFINITY;
      let foundStrictCandidate = false;

      for (const index of indexesToRank) {
        const candidate = remaining[index];
        const candidateStart = new Date(candidate.fechaInicio).getTime();
        const candidateEnd = new Date(candidate.fechaFin).getTime();

        const candidatePoint = this.eventPointFromResult(fullPool, candidate.id);
        const distanceKm =
          currentPoint && candidatePoint ? this.haversineKm(currentPoint, candidatePoint) : 2.5;
        const maxConsecutiveDistanceKm = strategy === 'walkable' ? 3 : 5;
        if (distanceKm > maxConsecutiveDistanceKm) continue;

        const gapMin = (candidateStart - effectiveCurrentEnd) / (1000 * 60);
        if (gapMin > maxAllowedGapMin) {
          continue;
        }
        // Rechazar solapamientos
        if (gapMin < 0) {
          continue;
        }

        const minTravelMinutes = this.estimateMinTravelMinutes(distanceKm, strategy);
        if (gapMin >= 0 && gapMin < minTravelMinutes) {
          continue;
        }

        foundStrictCandidate = true;

        const overlapPenalty = gapMin < 0 ? Math.min(6, Math.abs(gapMin) * 0.06) : 0;
        const waitPenalty = gapMin > 240 ? (gapMin - 240) * 0.008 : 0;
        const reverseTimePenalty = candidateStart < currentStart ? 4 : 0;
        const invalidDatePenalty =
          Number.isFinite(candidateStart) && Number.isFinite(candidateEnd) ? 0 : 5;
        const travelFeasibilityPenalty =
          gapMin >= 0 ? Math.max(0, minTravelMinutes - gapMin) * 0.04 : 0;

        const value =
          Number(candidate.score) * scoreWeight -
          distanceKm * distanceWeight -
          (overlapPenalty + waitPenalty + reverseTimePenalty + travelFeasibilityPenalty) *
            timeWeight -
          invalidDatePenalty;

        if (value > bestValue) {
          bestValue = value;
          bestIndex = index;
        }
      }

      if (!foundStrictCandidate) {
        bestIndex = indexesToRank[0];
        bestValue = Number.NEGATIVE_INFINITY;

        for (const index of indexesToRank) {
          const candidate = remaining[index];
          const candidateStart = new Date(candidate.fechaInicio).getTime();
          const candidateEnd = new Date(candidate.fechaFin).getTime();

          const candidatePoint = this.eventPointFromResult(fullPool, candidate.id);
          const distanceKm =
            currentPoint && candidatePoint ? this.haversineKm(currentPoint, candidatePoint) : 2.5;
          const maxConsecutiveDistanceKm = strategy === 'walkable' ? 3 : 5;
          if (distanceKm > maxConsecutiveDistanceKm) continue;

          const gapMin = (candidateStart - currentEnd) / (1000 * 60);
          if (gapMin > maxAllowedGapMin || gapMin < 0) {
            continue;
          }

          const minTravelMinutes = this.estimateMinTravelMinutes(distanceKm, strategy);

          const overlapPenalty = gapMin < 0 ? Math.min(10, Math.abs(gapMin) * 0.08) : 0;
          const waitPenalty = gapMin > 240 ? (gapMin - 240) * 0.008 : 0;
          const reverseTimePenalty = candidateStart < currentStart ? 4 : 0;
          const invalidDatePenalty =
            Number.isFinite(candidateStart) && Number.isFinite(candidateEnd) ? 0 : 5;
          const travelFeasibilityPenalty =
            gapMin >= 0 ? Math.max(0, minTravelMinutes - gapMin) * 0.06 : minTravelMinutes * 0.02;
          const maxGapExcessPenalty =
            gapMin > maxAllowedGapMin ? (gapMin - maxAllowedGapMin) * 0.012 : 0;
          const maxOverlapExcessPenalty =
            gapMin < -maxAllowedOverlapMin ? (Math.abs(gapMin) - maxAllowedOverlapMin) * 0.09 : 0;

          const value =
            Number(candidate.score) * scoreWeight -
            distanceKm * distanceWeight -
            (overlapPenalty +
              waitPenalty +
              reverseTimePenalty +
              travelFeasibilityPenalty +
              maxGapExcessPenalty +
              maxOverlapExcessPenalty) *
              timeWeight -
            invalidDatePenalty;

          if (value > bestValue) {
            bestValue = value;
            bestIndex = index;
          }
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
    strategy: 'balanced' | 'walkable' | 'score'
  ): number {
    const speedKmH = strategy === 'walkable' ? 5 : strategy === 'score' ? 26 : 18;
    const base = (distanceKm / speedKmH) * 60;
    const transferBuffer = strategy === 'walkable' ? 4 : 8;
    return Math.max(2, Math.round(base + transferBuffer));
  }

  private async storeSnapshot(user: User, top: ScoredEvent[]) {
    if (top.length === 0) return;

    const recommendedEvents = this.getUniqueRecommendedEvents(top);
    if (recommendedEvents.length === 0) return;

    const criterios = ['intereses', 'historial', 'distancia', 'fecha', 'valoraciones'];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let snapshot = await queryRunner.manager.findOne(Recomendacion, {
        where: { usuario: { id: user.id } },
        relations: ['usuario'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!snapshot) {
        snapshot = queryRunner.manager.create(Recomendacion, {
          usuario: user,
          eventosRecomendados: recommendedEvents,
          criterios,
          vista: false,
        });
        await queryRunner.manager.save(snapshot);
      } else {
        await queryRunner.manager.update(Recomendacion, snapshot.id, {
          criterios,
          vista: false,
        });

        // Limpiar las relaciones existentes en la misma transacción
        await queryRunner.query(
          'DELETE FROM "recomendacion_eventos_recomendados_events" WHERE "recomendacionId" = $1',
          [snapshot.id]
        );

        // Actualizar el snapshot en la misma transacción
        for (const event of recommendedEvents) {
          await queryRunner.query(
            `INSERT INTO "recomendacion_eventos_recomendados_events" ("recomendacionId", "eventsId")
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [snapshot.id, event.id]
          );
        }
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private getUniqueRecommendedEvents(top: ScoredEvent[]): Event[] {
    const seen = new Set<string>();
    const events: Event[] = [];

    for (const item of top) {
      const event = item.event;
      if (!event?.id || seen.has(event.id)) continue;
      seen.add(event.id);
      events.push(event);
    }

    return events;
  }

  private getEffectiveEventEndTime(startTimeMs: number, endTimeMs: number): number {
    const eventDurationMs = endTimeMs - startTimeMs;
    const eventDurationHours = eventDurationMs / (60 * 60 * 1000);

    // Estrategia progresiva para eventos largos:
    // - Evento 0-6 horas: usar duración real (son eventos normales)
    // - Evento 6-12 horas: limitar a 6 horas (media jornada)
    // - Evento > 12 horas: limitar a 2 horas (exposición/feria/evento permanente)
    //   Esto permite que otros eventos se encajen DURANTE el evento largo

    let maxEventDurationMs: number;

    if (eventDurationHours <= 6) {
      maxEventDurationMs = eventDurationMs;
    } else if (eventDurationHours <= 12) {
      maxEventDurationMs = 6 * 60 * 60 * 1000;
    } else {
      maxEventDurationMs = 2 * 60 * 60 * 1000;
    }

    const effectiveEnd = Math.min(startTimeMs + maxEventDurationMs, endTimeMs);
    return effectiveEnd;
  }

  private getWeight(envName: string, fallback: number): number {
    const rawValue = process.env[envName];
    if (!rawValue) return fallback;

    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private clampNumber(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number(value);
    const candidate = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(min, Math.min(max, candidate));
  }

  private compareOptionalDates(
    left: Date | string | null | undefined,
    right: Date | string | null | undefined
  ): number {
    const leftTime = this.toDateTime(left);
    const rightTime = this.toDateTime(right);

    if (leftTime === null && rightTime === null) return 0;
    if (leftTime === null) return 1;
    if (rightTime === null) return -1;
    return leftTime - rightTime;
  }

  private toDateTime(value: Date | string | number | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const date = new Date(value);
    const time = date.getTime();
    return Number.isFinite(time) ? time : null;
  }
}
