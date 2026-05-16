import { NotFoundException } from '@nestjs/common';
import { DataSource, DeepPartial, ObjectLiteral, Repository } from 'typeorm';
import { RecomendacionesService } from '../../src/recomendaciones/recomendaciones.service';
import { User } from '../../src/users/user.entity';
import { Event } from '../../src/events/event.entity';
import { Resena } from '../../src/events/resena.entity';
import { Recomendacion } from '../../src/recomendaciones/recomendacion.entity';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Categoria } from '../../src/categorias/categoria.entity';
import { EstadoEnum } from '../../src/events/enums/estado.enum';
import { RolEnum } from '../../src/users/enums/rol.enum';

const createRepo = <T extends ObjectLiteral>() =>
  ({
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  } as unknown as Repository<T>);

const makeUser = (overrides: Partial<User> = {}): User =>
  Object.assign(new User(), {
    id: 'user-1',
    nombre: 'Test User',
    email: 'user@example.com',
    contrasena: null,
    ubicacion: null,
    fotoPerfil: null,
    intereses: [],
    categoryOrder: [],
    radiusOptions: [],
    rol: RolEnum.USER,
    firebaseUid: 'firebase-uid',
    eventos: [],
    rutas: [],
    notificaciones: [],
    resenas: [],
    eventosAsistidos: [],
    eventosGuardados: [],
    eventosCompartidos: [],
    eventosVisitados: [],
    seguidores: [],
    seguidos: [],
    ...overrides,
  });

const makeCategory = (overrides: Partial<Categoria> = {}): Categoria =>
  Object.assign(new Categoria(), {
    id: 'cat-1',
    nombre: 'Categoria',
    descripcion: 'Descripcion valida',
    eventos: [],
    ...overrides,
  });

const makeEvent = (overrides: Partial<Event> = {}): Event =>
  Object.assign(new Event(), {
    id: 'event-1',
    title: 'Evento de prueba',
    description: 'Descripcion valida del evento',
    address: 'Calle Test 1',
    location: { type: 'Point', coordinates: [0, 0] },
    fechaInicio: new Date(),
    fechaFin: new Date(Date.now() + 60 * 60 * 1000),
    hasMultipleDatesAvailable: false,
    recurrencia: null,
    recurrenciaFin: null,
    precio: null,
    precioMin: null,
    precioMax: null,
    privado: false,
    linkAcceso: null,
    categoria: makeCategory(),
    estado: EstadoEnum.Pendiente,
    creador: makeUser(),
    imagen: null,
    imagenes: null,
    asistentes: [],
    ...overrides,
  });

const makeResena = (overrides: DeepPartial<Resena> = {}): Resena => {
  const base = new Resena();
  base.id = 'res-1';
  base.autor = makeUser();
  base.evento = makeEvent();
  base.comentario = 'Comentario';
  base.puntuacion = 4;
  base.fecha = new Date();

  if (overrides.autor) {
    base.autor = makeUser(overrides.autor as Partial<User>);
  }
  if (overrides.evento) {
    base.evento = makeEvent(overrides.evento as Partial<Event>);
  }

  return Object.assign(base, overrides);
};

function createResenaEntity(): Resena;
function createResenaEntity(entityLikeArray: DeepPartial<Resena>[]): Resena[];
function createResenaEntity(entityLike: DeepPartial<Resena>): Resena;
function createResenaEntity(
  data?: DeepPartial<Resena> | DeepPartial<Resena>[],
): Resena | Resena[] {
  if (Array.isArray(data)) {
    return data.map((item) => makeResena(item));
  }
  return makeResena(data ?? {});
}


// ---- helpers para tests de scoring ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMock = jest.MockedFunction<(...args: any[]) => any>;

const makeQueryBuilder = (events: Event[]) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getMany: (jest.fn() as AnyMock).mockResolvedValue(events),
});

const makeResenaQueryBuilder = (rawRows: { eventoId: string; avgScore: string }[] = []) => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getRawMany: (jest.fn() as AnyMock).mockResolvedValue(rawRows),
});

const makeQueryRunner = () => ({
  connect: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  release: jest.fn(),
  manager: { save: jest.fn() },
  query: jest.fn(),
});

const setupRecommendMocks = (
  userRepo: Repository<User>,
  eventRepo: Repository<Event>,
  resenaRepo: Repository<Resena>,
  recomendacionRepo: Repository<Recomendacion>,
  dataSource: DataSource,
  user: User,
  events: Event[],
  resenas: Resena[] = [],
  rawRatings: { eventoId: string; avgScore: string }[] = [],
) => {
  (userRepo.findOne as AnyMock).mockResolvedValue(user);
  (eventRepo.createQueryBuilder as AnyMock).mockReturnValue(makeQueryBuilder(events));
  (resenaRepo.find as AnyMock).mockResolvedValue(resenas);
  (resenaRepo.createQueryBuilder as AnyMock).mockReturnValue(makeResenaQueryBuilder(rawRatings));
  (recomendacionRepo.findOne as AnyMock).mockResolvedValue(null);
  (recomendacionRepo.create as AnyMock).mockImplementation((d) => d);
  (dataSource.createQueryRunner as AnyMock).mockReturnValue(makeQueryRunner());
};

describe('RecomendacionesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves an event for the user', async () => {
    const userRepo = createRepo<User>();
    const eventRepo = createRepo<Event>();
    const resenaRepo = createRepo<Resena>();
    const recomendacionRepo = createRepo<Recomendacion>();
    const dataSource = {} as DataSource;

    const service = new RecomendacionesService(
      userRepo,
      eventRepo,
      resenaRepo,
      recomendacionRepo,
      dataSource,
    );

    const user = makeUser({ id: 'user-1', eventosGuardados: [] });
    const event = makeEvent({ id: 'event-1' });

    const userFind = userRepo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    const eventFind = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    const userSave = userRepo.save as jest.MockedFunction<Repository<User>['save']>;

    userFind.mockResolvedValue(user);
    eventFind.mockResolvedValue(event);
    userSave.mockResolvedValue(user);

    const result = await service.saveEvent('user-1', 'event-1');

    expect(result).toEqual({ ok: true, action: 'guardado', eventId: 'event-1' });
    expect(user.eventosGuardados).toHaveLength(1);
    expect(userSave).toHaveBeenCalledWith(user);
  });

  it('removes a saved event', async () => {
    const userRepo = createRepo<User>();
    const eventRepo = createRepo<Event>();
    const resenaRepo = createRepo<Resena>();
    const recomendacionRepo = createRepo<Recomendacion>();
    const dataSource = {} as DataSource;

    const service = new RecomendacionesService(
      userRepo,
      eventRepo,
      resenaRepo,
      recomendacionRepo,
      dataSource,
    );

    const user = makeUser({
      id: 'user-1',
      eventosGuardados: [makeEvent({ id: 'event-1' })],
    });

    const userFind = userRepo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    const userSave = userRepo.save as jest.MockedFunction<Repository<User>['save']>;

    userFind.mockResolvedValue(user);
    userSave.mockResolvedValue(user);

    const result = await service.unsaveEvent('user-1', 'event-1');

    expect(result).toEqual({ ok: true, action: 'eliminado_guardado', eventId: 'event-1' });
    expect(user.eventosGuardados).toHaveLength(0);
    expect(userSave).toHaveBeenCalledWith(user);
  });

  it('throws when removing a saved event for missing user', async () => {
    const userRepo = createRepo<User>();
    const eventRepo = createRepo<Event>();
    const resenaRepo = createRepo<Resena>();
    const recomendacionRepo = createRepo<Recomendacion>();
    const dataSource = {} as DataSource;

    const service = new RecomendacionesService(
      userRepo,
      eventRepo,
      resenaRepo,
      recomendacionRepo,
      dataSource,
    );

    const userFind = userRepo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    userFind.mockResolvedValue(null);

    await expect(service.unsaveEvent('user-1', 'event-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rates an event and creates a review when missing', async () => {
    const userRepo = createRepo<User>();
    const eventRepo = createRepo<Event>();
    const resenaRepo = createRepo<Resena>();
    const recomendacionRepo = createRepo<Recomendacion>();
    const dataSource = {} as DataSource;

    const service = new RecomendacionesService(
      userRepo,
      eventRepo,
      resenaRepo,
      recomendacionRepo,
      dataSource,
    );

    const eventFind = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    const resenaFind = resenaRepo.findOne as jest.MockedFunction<Repository<Resena>['findOne']>;
    const resenaCreateMock = resenaRepo.create as jest.MockedFunction<Repository<Resena>['create']>;
    const resenaSave = resenaRepo.save as jest.MockedFunction<Repository<Resena>['save']>;

    eventFind.mockResolvedValue(makeEvent({ id: 'event-1' }));
    resenaFind.mockResolvedValue(null);
    resenaCreateMock.mockImplementation(createResenaEntity);
    resenaSave.mockResolvedValue(makeResena({ id: 'res-1' }));

    const result = await service.rateEvent('user-1', 'event-1', { puntuacion: 5, comentario: 'ok' });

    expect(result).toEqual({ ok: true, action: 'valorado', resenaId: 'res-1' });
    expect(resenaSave).toHaveBeenCalled();
  });

  it('returns empty rating when user has no review', async () => {
    const userRepo = createRepo<User>();
    const eventRepo = createRepo<Event>();
    const resenaRepo = createRepo<Resena>();
    const recomendacionRepo = createRepo<Recomendacion>();
    const dataSource = {} as DataSource;

    const service = new RecomendacionesService(
      userRepo,
      eventRepo,
      resenaRepo,
      recomendacionRepo,
      dataSource,
    );

    const resenaFind = resenaRepo.findOne as jest.MockedFunction<Repository<Resena>['findOne']>;
    resenaFind.mockResolvedValue(null);

    const result = await service.getMyEventRating('user-1', 'event-1');

    expect(result).toEqual({
      hasRating: false,
      puntuacion: null,
      comentario: '',
      fecha: null,
    });
  });

  // ---- Tests del algoritmo de scoring ----

  describe('recommendEvents — scoring por intereses del usuario', () => {
    const createService = () => {
      const userRepo = createRepo<User>();
      const eventRepo = createRepo<Event>();
      const resenaRepo = createRepo<Resena>();
      const recomendacionRepo = createRepo<Recomendacion>();
      const dataSource = { createQueryRunner: jest.fn() } as unknown as DataSource;
      const service = new RecomendacionesService(
        userRepo,
        eventRepo,
        resenaRepo,
        recomendacionRepo,
        dataSource,
      );
      return { service, userRepo, eventRepo, resenaRepo, recomendacionRepo, dataSource };
    };

    it('puntúa más alto el evento cuya categoría coincide con los intereses del usuario', async () => {
      const { service, userRepo, eventRepo, resenaRepo, recomendacionRepo, dataSource } =
        createService();

      const user = makeUser({ intereses: ['Música'] });
      const eventMusica = makeEvent({
        id: 'evt-music',
        title: 'Concierto de jazz',
        estado: EstadoEnum.Aprobado,
        privado: false,
        categoria: makeCategory({ nombre: 'Música' }),
        fechaInicio: new Date(Date.now() + 86400000),
        fechaFin: new Date(Date.now() + 2 * 86400000),
      });
      const eventOtro = makeEvent({
        id: 'evt-other',
        title: 'Feria de artesanía',
        estado: EstadoEnum.Aprobado,
        privado: false,
        categoria: makeCategory({ nombre: 'Arte' }),
        fechaInicio: new Date(Date.now() + 86400000),
        fechaFin: new Date(Date.now() + 2 * 86400000),
      });

      setupRecommendMocks(
        userRepo,
        eventRepo,
        resenaRepo,
        recomendacionRepo,
        dataSource,
        user,
        [eventMusica, eventOtro],
      );

      const result = await service.recommendEvents('user-1');
      const musicScore = result.eventos.find((e) => e.id === 'evt-music')!.score;
      const otroScore = result.eventos.find((e) => e.id === 'evt-other')!.score;

      expect(musicScore).toBeGreaterThan(otroScore);
    });

    it('incluye razón de intereses en el evento cuya categoría coincide', async () => {
      const { service, userRepo, eventRepo, resenaRepo, recomendacionRepo, dataSource } =
        createService();

      const user = makeUser({ intereses: ['Teatro'] });
      const event = makeEvent({
        estado: EstadoEnum.Aprobado,
        privado: false,
        categoria: makeCategory({ nombre: 'Teatro' }),
        fechaInicio: new Date(Date.now() + 86400000),
        fechaFin: new Date(Date.now() + 2 * 86400000),
      });

      setupRecommendMocks(userRepo, eventRepo, resenaRepo, recomendacionRepo, dataSource, user, [
        event,
      ]);

      const result = await service.recommendEvents('user-1');
      expect(result.eventos[0].reasons).toEqual(
        expect.arrayContaining([expect.stringContaining('intereses')]),
      );
    });

    it('no añade razón de intereses si el usuario no tiene intereses configurados', async () => {
      const { service, userRepo, eventRepo, resenaRepo, recomendacionRepo, dataSource } =
        createService();

      const user = makeUser({ intereses: [] });
      const event = makeEvent({
        estado: EstadoEnum.Aprobado,
        privado: false,
        categoria: makeCategory({ nombre: 'Música' }),
        fechaInicio: new Date(Date.now() + 86400000),
        fechaFin: new Date(Date.now() + 2 * 86400000),
      });

      setupRecommendMocks(userRepo, eventRepo, resenaRepo, recomendacionRepo, dataSource, user, [
        event,
      ]);

      const result = await service.recommendEvents('user-1');
      const reasons = result.eventos[0].reasons;
      expect(reasons.some((r) => r.includes('intereses'))).toBe(false);
    });

    it('puntúa más alto el evento guardado frente a un evento sin historial', async () => {
      const { service, userRepo, eventRepo, resenaRepo, recomendacionRepo, dataSource } =
        createService();

      const savedEvent = makeEvent({
        id: 'evt-saved',
        estado: EstadoEnum.Aprobado,
        privado: false,
        fechaInicio: new Date(Date.now() + 86400000),
        fechaFin: new Date(Date.now() + 2 * 86400000),
      });
      const freshEvent = makeEvent({
        id: 'evt-fresh',
        estado: EstadoEnum.Aprobado,
        privado: false,
        fechaInicio: new Date(Date.now() + 86400000),
        fechaFin: new Date(Date.now() + 2 * 86400000),
      });
      const user = makeUser({ eventosGuardados: [savedEvent] });

      setupRecommendMocks(
        userRepo,
        eventRepo,
        resenaRepo,
        recomendacionRepo,
        dataSource,
        user,
        [savedEvent, freshEvent],
      );

      const result = await service.recommendEvents('user-1');
      const savedScore = result.eventos.find((e) => e.id === 'evt-saved')!.score;
      const freshScore = result.eventos.find((e) => e.id === 'evt-fresh')!.score;

      expect(savedScore).toBeGreaterThan(freshScore);
    });

    it('filtra eventos fuera del radio cuando se pasa ubicación del usuario', async () => {
      const { service, userRepo, eventRepo, resenaRepo, recomendacionRepo, dataSource } =
        createService();

      const user = makeUser();
      const nearEvent = makeEvent({
        id: 'evt-near',
        estado: EstadoEnum.Aprobado,
        privado: false,
        location: { type: 'Point', coordinates: [-5.9845, 37.3891] } as any,
        fechaInicio: new Date(Date.now() + 86400000),
        fechaFin: new Date(Date.now() + 2 * 86400000),
      });
      const farEvent = makeEvent({
        id: 'evt-far',
        estado: EstadoEnum.Aprobado,
        privado: false,
        location: { type: 'Point', coordinates: [-3.7038, 40.4168] } as any,
        fechaInicio: new Date(Date.now() + 86400000),
        fechaFin: new Date(Date.now() + 2 * 86400000),
      });

      setupRecommendMocks(userRepo, eventRepo, resenaRepo, recomendacionRepo, dataSource, user, [
        nearEvent,
        farEvent,
      ]);

      const result = await service.recommendEvents('user-1', {
        lat: 37.3891,
        lng: -5.9845,
        radiusKm: 10,
      });

      const ids = result.eventos.map((e) => e.id);
      expect(ids).toContain('evt-near');
      expect(ids).not.toContain('evt-far');
    });

    it('respeta el límite de resultados indicado', async () => {
      const { service, userRepo, eventRepo, resenaRepo, recomendacionRepo, dataSource } =
        createService();

      const user = makeUser();
      const events = Array.from({ length: 10 }, (_, i) =>
        makeEvent({
          id: `evt-${i}`,
          estado: EstadoEnum.Aprobado,
          privado: false,
          fechaInicio: new Date(Date.now() + 86400000),
          fechaFin: new Date(Date.now() + 2 * 86400000),
        }),
      );

      setupRecommendMocks(userRepo, eventRepo, resenaRepo, recomendacionRepo, dataSource, user, events);

      const result = await service.recommendEvents('user-1', { limit: 3 });
      expect(result.eventos.length).toBeLessThanOrEqual(3);
    });

    it('normaliza categorías con acento — "Música" coincide con interés "musica"', async () => {
      const { service, userRepo, eventRepo, resenaRepo, recomendacionRepo, dataSource } =
        createService();

      const user = makeUser({ intereses: ['musica'] });
      const event = makeEvent({
        estado: EstadoEnum.Aprobado,
        privado: false,
        categoria: makeCategory({ nombre: 'Música' }),
        fechaInicio: new Date(Date.now() + 86400000),
        fechaFin: new Date(Date.now() + 2 * 86400000),
      });

      setupRecommendMocks(userRepo, eventRepo, resenaRepo, recomendacionRepo, dataSource, user, [
        event,
      ]);

      const result = await service.recommendEvents('user-1');
      expect(result.eventos[0].reasons).toEqual(
        expect.arrayContaining([expect.stringContaining('intereses')]),
      );
    });

    it('devuelve todos los criterios esperados en la respuesta', async () => {
      const { service, userRepo, eventRepo, resenaRepo, recomendacionRepo, dataSource } =
        createService();

      const user = makeUser();
      setupRecommendMocks(userRepo, eventRepo, resenaRepo, recomendacionRepo, dataSource, user, []);

      const result = await service.recommendEvents('user-1');
      expect(result.criterios).toEqual(
        expect.arrayContaining([
          'intereses-perfil',
          'eventos-guardados',
          'eventos-compartidos',
          'eventos-visitados',
          'eventos-apuntados',
          'valoraciones',
          'distancia',
          'fecha',
        ]),
      );
    });
  });
});
