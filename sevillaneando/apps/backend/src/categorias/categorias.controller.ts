import { Controller, Get, Post, Body, Delete, Param, Put, UseGuards } from '@nestjs/common';
import { Categoria } from './categoria.entity';
import { CreateCategoriaDTO } from './dto/create-categoria.dto';
import { CategoriasService } from './categorias.service';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriaService: CategoriasService) {}

  @Get()
  async findAll() {
    return await this.categoriaService.findAll();
  }

  @Post()
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() dto: CreateCategoriaDTO): Promise<Categoria> {
    return await this.categoriaService.create(dto);
  }

  @Put(':id')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: CreateCategoriaDTO): Promise<Categoria> {
    return await this.categoriaService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('admin')
  async delete(@Param('id') id: string): Promise<void> {
    return await this.categoriaService.delete(id);
  }
}
