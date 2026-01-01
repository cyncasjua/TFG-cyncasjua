import { Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { FirebaseAuthGuard } from './firebase.guard';

@Module({
  providers: [FirebaseService, FirebaseAuthGuard],
  exports: [FirebaseAuthGuard, FirebaseService]
})
export class AuthModule {}
