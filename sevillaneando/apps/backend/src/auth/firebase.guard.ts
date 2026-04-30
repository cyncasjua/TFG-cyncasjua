import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebaseService: FirebaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header = request.headers['authorization'] as string | undefined;
    if (!header || !header.startsWith('Bearer '))
      throw new UnauthorizedException('Token requerido');
    const token = header.replace('Bearer ', '');
    const decoded = await this.firebaseService.verifyToken(token);
    if (!decoded) throw new UnauthorizedException('Token inválido');
    request.user = decoded;
    return true;
  }
}
