import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventsService } from '../../src/events/events.service';
import { Event } from '../../src/events/event.entity';
import { Categoria } from '../../src/categorias/categoria.entity';
import { User } from '../../src/users/user.entity';
import { Mensaje } from '../../src/chat/mensaje.entity';
import { Resena } from '../../src/events/resena.entity';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EstadoEnum } from '../../src/events/enums/estado.enum';
import { RolEnum } from '../../src/users/enums/rol.enum';

jest.mock('uuid', () => ({ v4: () => 'uuid-123' }));

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

describe('EventsService', () => {
  const eventRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  } as unknown as Repository<Event>;

  const userRepo = {
    findOne: jest.fn(),
  } as unknown as Repository<User>;

  const mensajeRepo = {} as unknown as Repository<Mensaje>;
  const resenaRepo = {} as unknown as Repository<Resena>;

  const service = new EventsService(eventRepo, userRepo, mensajeRepo, resenaRepo);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates a share link for a private event without link', async () => {
    const event = makeEvent({
      id: 'event-1',
      privado: true,
      creador: makeUser({ id: 'user-1' }),
      linkAcceso: null,
    });

    const findOneMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    const saveMock = eventRepo.save as jest.MockedFunction<Repository<Event>['save']>;

    findOneMock.mockResolvedValue(event);
    saveMock.mockResolvedValue(event);

    const link = await service.getPrivateShareLink('event-1', 'user-1');

    expect(link).toBe('uuid-123');
    expect(saveMock).toHaveBeenCalledWith(event);
  });

  it('returns existing share link without saving', async () => {
    const event = makeEvent({
      id: 'event-2',
      privado: true,
      creador: makeUser({ id: 'user-1' }),
      linkAcceso: 'existing-link',
    });

    const findOneMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    const saveMock = eventRepo.save as jest.MockedFunction<Repository<Event>['save']>;

    findOneMock.mockResolvedValue(event);

    const link = await service.getPrivateShareLink('event-2', 'user-1');

    expect(link).toBe('existing-link');
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('throws when event is not found', async () => {
    const findOneMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    findOneMock.mockResolvedValue(null);

    await expect(service.getPrivateShareLink('event-3', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws when event is not private', async () => {
    const event = makeEvent({
      id: 'event-4',
      privado: false,
      creador: makeUser({ id: 'user-1' }),
      linkAcceso: null,
    });

    const findOneMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    findOneMock.mockResolvedValue(event);

    await expect(service.getPrivateShareLink('event-4', 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws when requester is not the creator', async () => {
    const event = makeEvent({
      id: 'event-5',
      privado: true,
      creador: makeUser({ id: 'user-2' }),
      linkAcceso: null,
    });

    const findOneMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    findOneMock.mockResolvedValue(event);

    await expect(service.getPrivateShareLink('event-5', 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('adds attendee when not already attending', async () => {
    const event = makeEvent({
      id: 'event-6',
      asistentes: [],
    });

    const user = makeUser({ id: 'user-1' });

    const eventFindMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    const userFindMock = userRepo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    const saveMock = eventRepo.save as jest.MockedFunction<Repository<Event>['save']>;

    eventFindMock.mockResolvedValue(event);
    userFindMock.mockResolvedValue(user);
    saveMock.mockResolvedValue(event);

    const attendees = await service.addAttendee('event-6', 'user-1');

    expect(attendees).toHaveLength(1);
    expect(attendees[0].id).toBe('user-1');
    expect(saveMock).toHaveBeenCalled();
  });

  it('does not duplicate attendee', async () => {
    const user = makeUser({ id: 'user-1' });
    const event = makeEvent({
      id: 'event-7',
      asistentes: [user],
    });

    const eventFindMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    const userFindMock = userRepo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    const saveMock = eventRepo.save as jest.MockedFunction<Repository<Event>['save']>;

    eventFindMock.mockResolvedValue(event);
    userFindMock.mockResolvedValue(user);

    const attendees = await service.addAttendee('event-7', 'user-1');

    expect(attendees).toHaveLength(1);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when adding attendee to missing event', async () => {
    const eventFindMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    eventFindMock.mockResolvedValue(null);

    await expect(service.addAttendee('no-event', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when adding missing user as attendee', async () => {
    const event = makeEvent({ id: 'event-8', asistentes: [] });

    const eventFindMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    const userFindMock = userRepo.findOne as jest.MockedFunction<Repository<User>['findOne']>;

    eventFindMock.mockResolvedValue(event);
    userFindMock.mockResolvedValue(null);

    await expect(service.addAttendee('event-8', 'no-user')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes an attendee from event', async () => {
    const user = makeUser({ id: 'user-1' });
    const event = makeEvent({ id: 'event-9', asistentes: [user] });

    const eventFindMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    const saveMock = eventRepo.save as jest.MockedFunction<Repository<Event>['save']>;

    eventFindMock.mockResolvedValue(event);
    saveMock.mockResolvedValue(event);

    const attendees = await service.removeAttendee('event-9', 'user-1');

    expect(attendees).toHaveLength(0);
    expect(saveMock).toHaveBeenCalled();
  });

  it('throws NotFoundException when removing attendee from missing event', async () => {
    const eventFindMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    eventFindMock.mockResolvedValue(null);

    await expect(service.removeAttendee('no-event', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns event when found by id', async () => {
    const event = makeEvent({ id: 'event-10' });
    const eventFindMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    eventFindMock.mockResolvedValue(event);

    const result = await service.findOne('event-10');
    expect(result.id).toBe('event-10');
  });

  it('throws NotFoundException when event not found by id', async () => {
    const eventFindMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    eventFindMock.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns attendees list for existing event', async () => {
    const user = makeUser({ id: 'user-1' });
    const event = makeEvent({ id: 'event-11', asistentes: [user] });

    const eventFindMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    eventFindMock.mockResolvedValue(event);

    const attendees = await service.getAttendees('event-11');
    expect(attendees).toHaveLength(1);
    expect(attendees[0].id).toBe('user-1');
  });

  it('throws NotFoundException when getting attendees for missing event', async () => {
    const eventFindMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    eventFindMock.mockResolvedValue(null);

    await expect(service.getAttendees('no-event')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns true when user is attending event', async () => {
    const user = makeUser({ id: 'user-1' });
    const event = makeEvent({ id: 'event-12', asistentes: [user] });

    const eventFindMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    eventFindMock.mockResolvedValue(event);

    const result = await service.isAttending('event-12', 'user-1');
    expect(result).toBe(true);
  });

  it('returns false when user is not attending event', async () => {
    const event = makeEvent({ id: 'event-13', asistentes: [] });

    const eventFindMock = eventRepo.findOne as jest.MockedFunction<Repository<Event>['findOne']>;
    eventFindMock.mockResolvedValue(event);

    const result = await service.isAttending('event-13', 'user-1');
    expect(result).toBe(false);
  });
});
