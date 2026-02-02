import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersService } from '../users/users.service';
import { ROLES_KEY, UserRole } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(UsersService) private readonly usersService: UsersService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const firebaseUser = request.user as { uid?: string; role?: UserRole } | undefined;

    let role: UserRole | undefined = firebaseUser?.role as UserRole | undefined;

    if (!role && firebaseUser?.uid) {
      try {
        const dbUser = await this.usersService.findByFirebaseUid(firebaseUser.uid);
        if (dbUser) {
          role = dbUser.rol as UserRole;
          request.user.role = role;
        }
      } catch (err) {
        console.warn('Error buscando usuario en BD:', err);
      }
    }

    if (!role) role = 'user';

    if (requiredRoles.includes(role)) return true;

    throw new ForbiddenException('Permisos insuficientes');
  }
}
