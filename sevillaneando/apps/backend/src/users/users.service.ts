import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { RolEnum } from './enums/rol.enum';
import type { GeoJsonPoint } from '../common/geojson-point';
import { Categoria } from '../categorias/categoria.entity';
import { normalizeInteres, normalizeIntereses } from './enums/interes-categoria.enum';
import { FirebaseService } from '../auth/firebase.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Categoria) private readonly categoriaRepo: Repository<Categoria>,
    @Inject(forwardRef(() => FirebaseService)) private readonly firebaseService: FirebaseService,
    private readonly cloudinaryService: CloudinaryService
  ) {}

  private async resolveIntereses(values: unknown): Promise<string[]> {
    const normalizedValues = normalizeIntereses(values);
    if (normalizedValues.length === 0) return [];

    const categorias = await this.categoriaRepo.find({ select: { nombre: true } });
    const categoriasByNormalizedName = new Map(
      categorias.map((categoria) => [normalizeInteres(categoria.nombre), categoria.nombre])
    );

    return normalizedValues
      .map((value) => categoriasByNormalizedName.get(value))
      .filter((value): value is string => Boolean(value));
  }

  async ensureFromFirebase(payload: {
    uid: string;
    email?: string | null;
    name?: string | null;
  }): Promise<User> {
    const { uid, email, name } = payload;

    let user = await this.usersRepo.findOne({ where: { firebaseUid: uid } });

    if (!user && email) {
      user = await this.usersRepo.findOne({ where: { email } });
      if (user) {
        user.firebaseUid = uid;
        await this.usersRepo.save(user);
      }
    }

    if (!user) {
      user = this.usersRepo.create({
        firebaseUid: uid,
        email: email ?? `${uid}@unknown.local`,
        nombre: name ?? 'Sin nombre',
        contrasena: null,
        ubicacion: null,
        fotoPerfil: null,
        fotoPerfilPublicId: null,
        intereses: [],
        categoryOrder: [],
        radiusOptions: [],
        rol: RolEnum.USER,
        privacyAcceptedAt: new Date(),
      });
      await this.usersRepo.save(user);
    } else {
      let changed = false;
      if (email && user.email !== email) {
        user.email = email;
        changed = true;
      }
      if (name && user.nombre !== name) {
        user.nombre = name;
        changed = true;
      }
      if (changed) {
        await this.usersRepo.save(user);
      }
    }

    return user;
  }

  findAll(): Promise<User[]> {
    return this.usersRepo.find();
  }

  findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { firebaseUid } });
  }

  async updateRole(id: string, rol: RolEnum): Promise<User> {
    const user = await this.usersRepo.findOneOrFail({ where: { id } });
    user.rol = rol;
    return this.usersRepo.save(user);
  }

  async updateProfile(
    firebaseUid: string,
    data: {
      nombre?: string;
      email?: string;
      ubicacion?: GeoJsonPoint;
      fotoPerfil?: string;
      fotoPerfilPublicId?: string;
      intereses?: string[];
      categoryOrder?: string[];
      radiusOptions?: number[];
    }
  ): Promise<User> {
    const user = await this.usersRepo.findOneOrFail({ where: { firebaseUid } });
    if (data.nombre !== undefined) user.nombre = data.nombre;
    if (data.email !== undefined) user.email = data.email;
    if (data.ubicacion !== undefined) user.ubicacion = data.ubicacion;
    if (data.fotoPerfil !== undefined) user.fotoPerfil = data.fotoPerfil;
    if (data.fotoPerfilPublicId !== undefined) user.fotoPerfilPublicId = data.fotoPerfilPublicId;
    if (data.intereses !== undefined) user.intereses = await this.resolveIntereses(data.intereses);
    if (data.categoryOrder !== undefined) user.categoryOrder = data.categoryOrder;
    if (data.radiusOptions !== undefined) user.radiusOptions = data.radiusOptions;
    return this.usersRepo.save(user);
  }

  async deleteByFirebaseUid(firebaseUid: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { firebaseUid } });
    if (!user) return;
    // El cliente Firebase ya borra su propia cuenta tras recibir el 200.
    // No llamamos a firebaseService.deleteUser aquí para no invalidar el token
    // antes de que el SDK del cliente pueda completar el deleteUser().
    await this.deleteDbRecordsById(user.id);
  }

  async deleteCompletelyById(id: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) return;
    if (user.firebaseUid) {
      try {
        await this.firebaseService.deleteUser(user.firebaseUid);
      } catch (e) {
        console.error(
          `[UserDeletion] Failed to delete Firebase user ${user.firebaseUid} (db id: ${id}):`,
          e
        );
        throw new Error(`No se pudo borrar el usuario de Firebase Auth: ${(e as Error).message}`);
      }
    } else {
      console.warn(`[UserDeletion] User ${id} has no firebaseUid, skipping Firebase deletion`);
    }
    await this.deleteDbRecordsById(id);
  }

  private async deleteDbRecordsById(id: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (user?.fotoPerfilPublicId) {
      try {
        await this.cloudinaryService.deleteImage(user.fotoPerfilPublicId);
      } catch (e) {
        console.error(`[UserDeletion] Failed to delete Cloudinary image for user ${id}:`, e);
      }
    }
    const em = this.usersRepo.manager;
    await em.query('DELETE FROM user_seguidores WHERE seguidor_id = $1 OR seguido_id = $1', [id]);
    await em.query('DELETE FROM user_saved_events WHERE user_id = $1', [id]);
    await em.query('DELETE FROM user_shared_events WHERE user_id = $1', [id]);
    await em.query('DELETE FROM user_visited_events WHERE user_id = $1', [id]);
    await em.query('DELETE FROM event_asistentes WHERE user_id = $1', [id]);
    await this.usersRepo.delete({ id });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async searchUsers(query: string): Promise<User[]> {
    return this.usersRepo
      .createQueryBuilder('user')
      .where('LOWER(user.nombre) LIKE :q OR LOWER(user.email) LIKE :q', {
        q: `%${query.toLowerCase()}%`,
      })
      .limit(20)
      .getMany();
  }

  async seguir(seguidorId: string, seguidoId: string): Promise<void> {
    if (seguidorId === seguidoId) return;
    const [seguidor, seguido] = await Promise.all([
      this.usersRepo.findOne({ where: { id: seguidorId }, relations: ['seguidos'] }),
      this.usersRepo.findOne({ where: { id: seguidoId } }),
    ]);
    if (!seguidor || !seguido) return;
    const yaSigue = seguidor.seguidos.some((u) => u.id === seguidoId);
    if (!yaSigue) {
      seguidor.seguidos.push(seguido);
      await this.usersRepo.save(seguidor);
    }
  }

  async dejarDeSeguir(seguidorId: string, seguidoId: string): Promise<void> {
    const seguidor = await this.usersRepo.findOne({
      where: { id: seguidorId },
      relations: ['seguidos'],
    });
    if (!seguidor) return;
    seguidor.seguidos = seguidor.seguidos.filter((u) => u.id !== seguidoId);
    await this.usersRepo.save(seguidor);
  }

  async getSeguidos(userId: string): Promise<User[]> {
    const user = await this.usersRepo.findOne({ where: { id: userId }, relations: ['seguidos'] });
    return user?.seguidos ?? [];
  }

  async getSeguidores(userId: string): Promise<User[]> {
    const user = await this.usersRepo.findOne({ where: { id: userId }, relations: ['seguidores'] });
    return user?.seguidores ?? [];
  }

  async isSiguiendo(seguidorId: string, seguidoId: string): Promise<boolean> {
    const user = await this.usersRepo.findOne({
      where: { id: seguidorId },
      relations: ['seguidos'],
    });
    return user?.seguidos.some((u) => u.id === seguidoId) ?? false;
  }

  async getAdminStats(): Promise<{
    totalUsuarios: number;
    totalEventos: number;
    eventosPendientes: number;
    eventosAprobados: number;
    eventosRechazados: number;
    eventosScrapeados: number;
    eventosUsuario: number;
  }> {
    const em = this.usersRepo.manager;
    const scraperUid = process.env.SCRAPER_SYSTEM_UID || 'system-scraper-uid';
    const scraperEmail = process.env.SCRAPER_SYSTEM_EMAIL || 'scraper.bot@sevillaneando.local';

    const [
      [{ count: totalUsuarios }],
      [{ count: totalEventos }],
      [{ count: eventosPendientes }],
      [{ count: eventosAprobados }],
      [{ count: eventosRechazados }],
      [{ count: eventosScrapeados }],
    ] = await Promise.all([
      em.query<[{ count: string }]>('SELECT COUNT(*) as count FROM "user"'),
      em.query<[{ count: string }]>('SELECT COUNT(*) as count FROM "events"'),
      em.query<[{ count: string }]>('SELECT COUNT(*) as count FROM "events" WHERE estado = $1', [
        'pendiente',
      ]),
      em.query<[{ count: string }]>('SELECT COUNT(*) as count FROM "events" WHERE estado = $1', [
        'aprobado',
      ]),
      em.query<[{ count: string }]>('SELECT COUNT(*) as count FROM "events" WHERE estado = $1', [
        'rechazado',
      ]),
      em.query<[{ count: string }]>(
        `SELECT COUNT(*) as count FROM "events" e
         INNER JOIN "user" u ON u.id = e."creadorId"
         WHERE u."firebaseUid" = $1 OR u.email = $2`,
        [scraperUid, scraperEmail]
      ),
    ]);

    const total = Number(totalEventos);
    const scrapeados = Number(eventosScrapeados);

    return {
      totalUsuarios: Number(totalUsuarios),
      totalEventos: total,
      eventosPendientes: Number(eventosPendientes),
      eventosAprobados: Number(eventosAprobados),
      eventosRechazados: Number(eventosRechazados),
      eventosScrapeados: scrapeados,
      eventosUsuario: total - scrapeados,
    };
  }
}
