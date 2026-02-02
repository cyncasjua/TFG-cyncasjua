import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { FirebaseService } from './firebase.service';
import { FirebaseAuthGuard } from './firebase.guard';
import { RolesGuard } from './roles.guard';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'changeme',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [FirebaseService, FirebaseAuthGuard, RolesGuard],
  exports: [FirebaseAuthGuard, FirebaseService, RolesGuard, UsersModule],
})
export class AuthModule {}
