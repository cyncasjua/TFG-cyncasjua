import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);

  constructor(private readonly config: ConfigService) {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (!admin.apps.length && projectId && clientEmail && privateKey) {
      try {
        this.logger.log('Intentando inicializar Firebase...');
        admin.initializeApp({
          credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        });
      } catch (error) {
        this.logger.error('Error al inicializar Firebase:', error);
      }
    } else {
      this.logger.warn('Firebase admin no inicializado: revisa variables de entorno.');
    }
  }

  async verifyToken(idToken: string) {
    if (!admin.apps.length) return null;
    try {
      return await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      this.logger.warn(`Fallo al verificar token: ${error}`);
      return null;
    }
  }

  async deleteUser(firebaseUid: string): Promise<void> {
    if (!admin.apps.length) {
      throw new Error(
        'Firebase Admin no está inicializado: no se puede borrar el usuario de Firebase Auth'
      );
    }
    await admin.auth().deleteUser(firebaseUid);
  }
}
