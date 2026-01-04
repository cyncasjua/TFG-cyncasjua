import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolEnum, User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly usersRepo: Repository<User>) {}

  async ensureFromFirebase(payload: { uid: string; email?: string | null; name?: string | null }): Promise<User> {
    const { uid, email, name } = payload;
    
    // Busca primero por firebaseUid (si ya se sincronizó)
    let user = await this.usersRepo.findOne({ where: { firebaseUid: uid } });
    
    // Si no encuentra por UID pero hay email, busca por email (caso seed)
    if (!user && email) {
      user = await this.usersRepo.findOne({ where: { email } });
      if (user) {
        // Actualiza el firebaseUid si cambió
        user.firebaseUid = uid;
        await this.usersRepo.save(user);
      }
    }
    
    // Si aún no existe, crea nuevo
    if (!user) {
      user = this.usersRepo.create({
        firebaseUid: uid,
        email: email ?? `${uid}@unknown.local`,
        nombre: name ?? 'Sin nombre',
        contrasena: null,
        ubicacion: null,
        fotoPerfil: null,
        intereses: [],
        rol: RolEnum.USER
      });
      await this.usersRepo.save(user);
    } else {
      // Sincroniza email/nombre si cambian en Firebase
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
}
