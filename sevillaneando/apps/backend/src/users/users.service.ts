import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolEnum, User } from './user.entity';
import * as admin from 'firebase-admin';

interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number];
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly usersRepo: Repository<User>) {}

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
        intereses: [],
        rol: RolEnum.USER,
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
      intereses?: string[];
    }
  ): Promise<User> {
    const user = await this.usersRepo.findOneOrFail({ where: { firebaseUid } });
    if (data.nombre !== undefined) user.nombre = data.nombre;
    if (data.email !== undefined) user.email = data.email;
    if (data.ubicacion !== undefined) user.ubicacion = data.ubicacion;
    if (data.fotoPerfil !== undefined) user.fotoPerfil = data.fotoPerfil;
    if (data.intereses !== undefined) user.intereses = data.intereses;
    return this.usersRepo.save(user);
  }

  async deleteByFirebaseUid(firebaseUid: string): Promise<void> {
    await this.usersRepo.delete({ firebaseUid });
  }

  async deleteCompletelyById(id: string): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) return;
    if (user.firebaseUid) {
      try {
        await admin.auth().deleteUser(user.firebaseUid);
      } catch (e) {
        // Ignorar errores al borrar usuario de Firebase
      }
    }
    await this.usersRepo.delete({ id });
  }
}
