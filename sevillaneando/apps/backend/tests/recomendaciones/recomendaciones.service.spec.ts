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
    save: jest.fn(),
    create: jest.fn(),
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
});
