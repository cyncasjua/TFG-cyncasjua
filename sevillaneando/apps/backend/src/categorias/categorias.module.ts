import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Categoria } from './categoria.entity';
import { CategoriasController } from './categorias.controller';
import { CategoriasService } from './categorias.service';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Categoria, User]), AuthModule],
  controllers: [CategoriasController],
  providers: [CategoriasService],
  exports: [CategoriasService],
})
export class CategoriasModule {}
