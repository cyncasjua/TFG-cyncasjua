import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { FirebaseService } from './firebase.service';
import { FirebaseAuthGuard } from './firebase.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [forwardRef(() => UsersModule)],
  providers: [FirebaseService, FirebaseAuthGuard, RolesGuard],
  exports: [FirebaseAuthGuard, FirebaseService, RolesGuard, UsersModule]
})
export class AuthModule {}
