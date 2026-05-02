import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { RolEnum } from '../users/enums/rol.enum';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(@InjectRepository(User) private readonly usersRepo: Repository<User>) {}

  async seed() {
    const existingUsers = await this.usersRepo.count();
    if (existingUsers > 0) {
      this.logger.log('Base de datos ya tiene usuarios, saltando seed.');
      return;
    }

    const users = [
      {
        firebaseUid: 'admin-uid-test',
        email: 'admin@demo.com',
        nombre: 'Admin Demo',
        rol: RolEnum.ADMIN,
        contrasena: null,
        ubicacion: null,
        fotoPerfil: null,
        intereses: [],
      },
      {
        firebaseUid: 'moderator-uid-test',
        email: 'mod@demo.com',
        nombre: 'Moderator Demo',
        rol: RolEnum.MODERATOR,
        contrasena: null,
        ubicacion: null,
        fotoPerfil: null,
        intereses: [],
      },
      {
        firebaseUid: 'user-uid-test',
        email: 'user@demo.com',
        nombre: 'User Demo',
        rol: RolEnum.USER,
        contrasena: null,
        ubicacion: null,
        fotoPerfil: null,
        intereses: [],
      },
    ];

    for (const userData of users) {
      const user = this.usersRepo.create(userData);
      await this.usersRepo.save(user);
    }

    this.logger.log('Seed de usuarios completado: admin, moderator, user.');
  }
}
