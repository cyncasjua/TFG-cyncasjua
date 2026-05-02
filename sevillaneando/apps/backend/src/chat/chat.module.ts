import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import { AuthModule } from '../auth/auth.module';
import { Mensaje } from './mensaje.entity';
import { MensajePrivado } from './mensaje-privado.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Mensaje, MensajePrivado]), AuthModule],
    controllers: [ChatController],
})
export class ChatModule { }
