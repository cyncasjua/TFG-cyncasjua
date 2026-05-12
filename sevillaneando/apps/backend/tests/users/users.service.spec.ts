import { DeepPartial, Repository } from 'typeorm';
import { UsersService } from '../../src/users/users.service';
import { User } from '../../src/users/user.entity';
import { RolEnum } from '../../src/users/enums/rol.enum';
import { Categoria } from '../../src/categorias/categoria.entity';
import { FirebaseService } from '../../src/auth/firebase.service';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const makeUser = (overrides: DeepPartial<User> = {}): User => {
  const base = new User();
  base.id = 'user-1';
  base.nombre = 'Test User';
  base.email = 'user@example.com';
  base.contrasena = null;
  base.ubicacion = null;
  base.fotoPerfil = null;
  base.intereses = [];
  base.categoryOrder = [];
  base.radiusOptions = [];
  base.rol = RolEnum.USER;
  base.firebaseUid = 'firebase-uid';
  base.eventos = [];
  base.rutas = [];
  base.notificaciones = [];
  base.resenas = [];
  base.eventosAsistidos = [];
  base.eventosGuardados = [];
  base.eventosCompartidos = [];
  base.eventosVisitados = [];
  base.seguidores = [];
  base.seguidos = [];

  if (overrides.ubicacion) {
    const coords = (overrides.ubicacion as { coordinates?: [number, number] | number[] })
      .coordinates ?? [0, 0];
    base.ubicacion = {
      type: 'Point',
      coordinates: [Number(coords[0] ?? 0), Number(coords[1] ?? 0)],
    };
  }

  return Object.assign(base, overrides);
};

function createUserEntity(): User;
function createUserEntity(entityLikeArray: DeepPartial<User>[]): User[];
function createUserEntity(entityLike: DeepPartial<User>): User;
function createUserEntity(
  data?: DeepPartial<User> | DeepPartial<User>[],
): User | User[] {
  if (Array.isArray(data)) {
    return data.map((item) => makeUser(item));
  }
  return makeUser(data ?? {});
}

const createUserRepo = () =>
  ({
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  } as unknown as Repository<User>);

const createService = (repo: Repository<User>) =>
  new UsersService(repo, {} as Repository<Categoria>, {} as FirebaseService);

describe('UsersService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a user from firebase when not found', async () => {
    const repo = createUserRepo();
    const service = createService(repo);

    const findOneMock = repo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    const createMock = repo.create as jest.MockedFunction<Repository<User>['create']>;
    const saveMock = repo.save as jest.MockedFunction<Repository<User>['save']>;

    findOneMock.mockResolvedValue(null);
    createMock.mockImplementation(createUserEntity);
    saveMock.mockResolvedValue(makeUser({ id: 'user-1' }));

    const user = await service.ensureFromFirebase({ uid: 'uid-1' });

    expect(user.firebaseUid).toBe('uid-1');
    expect(user.email).toBe('uid-1@unknown.local');
    expect(user.rol).toBe(RolEnum.USER);
    expect(saveMock).toHaveBeenCalled();
  });

  it('updates existing user data when changed', async () => {
    const repo = createUserRepo();
    const service = createService(repo);

    const existing = makeUser({
      id: 'user-2',
      firebaseUid: 'uid-2',
      email: 'old@ex.com',
      nombre: 'Old',
    });

    const findOneMock = repo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    const saveMock = repo.save as jest.MockedFunction<Repository<User>['save']>;

    findOneMock.mockResolvedValue(existing);
    saveMock.mockResolvedValue(existing);

    const user = await service.ensureFromFirebase({ uid: 'uid-2', email: 'new@ex.com', name: 'New' });

    expect(user.email).toBe('new@ex.com');
    expect(user.nombre).toBe('New');
    expect(saveMock).toHaveBeenCalled();
  });

  it('skips follow when same user', async () => {
    const repo = createUserRepo();
    const service = createService(repo);

    await service.seguir('user-1', 'user-1');

    const findOneMock = repo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    expect(findOneMock).not.toHaveBeenCalled();
  });

  it('adds follow when not already following', async () => {
    const repo = createUserRepo();
    const service = createService(repo);

    const seguidor = makeUser({ id: 'user-1', seguidos: [] });
    const seguido = makeUser({ id: 'user-2' });

    const findOneMock = repo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    const saveMock = repo.save as jest.MockedFunction<Repository<User>['save']>;

    findOneMock
      .mockResolvedValueOnce(seguidor)
      .mockResolvedValueOnce(seguido);

    await service.seguir('user-1', 'user-2');

    expect(seguidor.seguidos).toHaveLength(1);
    expect(seguidor.seguidos[0].id).toBe('user-2');
    expect(saveMock).toHaveBeenCalledWith(seguidor);
  });

  it('does not add duplicate follow', async () => {
    const repo = createUserRepo();
    const service = createService(repo);

    const seguido = makeUser({ id: 'user-2' });
    const seguidor = makeUser({ id: 'user-1', seguidos: [seguido] });

    const findOneMock = repo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    const saveMock = repo.save as jest.MockedFunction<Repository<User>['save']>;

    findOneMock
      .mockResolvedValueOnce(seguidor)
      .mockResolvedValueOnce(seguido);

    await service.seguir('user-1', 'user-2');

    expect(seguidor.seguidos).toHaveLength(1);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('removes follow when unfollowing', async () => {
    const repo = createUserRepo();
    const service = createService(repo);

    const seguido = makeUser({ id: 'user-2' });
    const seguidor = makeUser({ id: 'user-1', seguidos: [seguido] });

    const findOneMock = repo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    const saveMock = repo.save as jest.MockedFunction<Repository<User>['save']>;

    findOneMock.mockResolvedValueOnce(seguidor);
    saveMock.mockResolvedValue(seguidor);

    await service.dejarDeSeguir('user-1', 'user-2');

    expect(seguidor.seguidos).toHaveLength(0);
    expect(saveMock).toHaveBeenCalledWith(seguidor);
  });

  it('returns seguidos list for a user', async () => {
    const repo = createUserRepo();
    const service = createService(repo);

    const seguido = makeUser({ id: 'user-2' });
    const user = makeUser({ id: 'user-1', seguidos: [seguido] });

    const findOneMock = repo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    findOneMock.mockResolvedValueOnce(user);

    const result = await service.getSeguidos('user-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('user-2');
  });

  it('returns empty array when user not found in getSeguidos', async () => {
    const repo = createUserRepo();
    const service = createService(repo);

    const findOneMock = repo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    findOneMock.mockResolvedValueOnce(null);

    const result = await service.getSeguidos('unknown');
    expect(result).toEqual([]);
  });

  it('returns true when user is following another', async () => {
    const repo = createUserRepo();
    const service = createService(repo);

    const seguido = makeUser({ id: 'user-2' });
    const user = makeUser({ id: 'user-1', seguidos: [seguido] });

    const findOneMock = repo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    findOneMock.mockResolvedValueOnce(user);

    const result = await service.isSiguiendo('user-1', 'user-2');
    expect(result).toBe(true);
  });

  it('returns false when user is not following another', async () => {
    const repo = createUserRepo();
    const service = createService(repo);

    const user = makeUser({ id: 'user-1', seguidos: [] });

    const findOneMock = repo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    findOneMock.mockResolvedValueOnce(user);

    const result = await service.isSiguiendo('user-1', 'user-2');
    expect(result).toBe(false);
  });

  it('updates role for existing user', async () => {
    const repo = createUserRepo();
    const service = createService(repo);

    const user = makeUser({ id: 'user-1', rol: RolEnum.USER });

    const findOneOrFailMock = repo.findOneOrFail as jest.MockedFunction<Repository<User>['findOneOrFail']>;
    const saveMock = repo.save as jest.MockedFunction<Repository<User>['save']>;

    findOneOrFailMock.mockResolvedValue(user);
    saveMock.mockResolvedValue({ ...user, rol: RolEnum.ADMIN } as User);

    await service.updateRole('user-1', RolEnum.ADMIN);

    expect(user.rol).toBe(RolEnum.ADMIN);
    expect(saveMock).toHaveBeenCalledWith(user);
  });

  it('updates profile fields for existing user', async () => {
    const repo = createUserRepo();
    const service = createService(repo);

    const user = makeUser({ firebaseUid: 'uid-1', nombre: 'Old', email: 'old@ex.com' });

    const findOneOrFailMock = repo.findOneOrFail as jest.MockedFunction<Repository<User>['findOneOrFail']>;
    const saveMock = repo.save as jest.MockedFunction<Repository<User>['save']>;

    findOneOrFailMock.mockResolvedValue(user);
    saveMock.mockResolvedValue(user);

    await service.updateProfile('uid-1', { nombre: 'New', email: 'new@ex.com' });

    expect(user.nombre).toBe('New');
    expect(user.email).toBe('new@ex.com');
    expect(saveMock).toHaveBeenCalledWith(user);
  });

  it('skips unchanged profile fields', async () => {
    const repo = createUserRepo();
    const service = createService(repo);

    const user = makeUser({ firebaseUid: 'uid-1', nombre: 'Same', email: 'same@ex.com' });

    const findOneOrFailMock = repo.findOneOrFail as jest.MockedFunction<Repository<User>['findOneOrFail']>;
    const saveMock = repo.save as jest.MockedFunction<Repository<User>['save']>;

    findOneOrFailMock.mockResolvedValue(user);
    saveMock.mockResolvedValue(user);

    await service.updateProfile('uid-1', {});

    expect(user.nombre).toBe('Same');
    expect(user.email).toBe('same@ex.com');
    expect(saveMock).toHaveBeenCalled();
  });

  it('does not create user when firebase uid exists but email also matches existing', async () => {
    const repo = createUserRepo();
    const service = createService(repo);

    const existing = makeUser({ firebaseUid: 'uid-3', email: 'match@ex.com', nombre: 'Match' });

    const findOneMock = repo.findOne as jest.MockedFunction<Repository<User>['findOne']>;
    const saveMock = repo.save as jest.MockedFunction<Repository<User>['save']>;

    findOneMock.mockResolvedValueOnce(existing);
    saveMock.mockResolvedValue(existing);

    const result = await service.ensureFromFirebase({ uid: 'uid-3', email: 'match@ex.com' });

    expect(result.firebaseUid).toBe('uid-3');
    expect(saveMock).not.toHaveBeenCalled();
  });
});
