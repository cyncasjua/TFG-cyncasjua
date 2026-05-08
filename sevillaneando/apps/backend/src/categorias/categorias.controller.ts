import { Controller, Get, Post, Body, Delete, Param, Put, UseGuards } from '@nestjs/common';
import { Categoria } from './categoria.entity';
import { CreateCategoriaDTO } from './dto/create-categoria.dto';
import { CategoriasService } from './categorias.service';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@ApiTags('Categorías')
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriaService: CategoriasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las categorías' })
  @ApiResponse({ status: 200, description: 'Lista de categorías', type: [Categoria] })
  async findAll() {
    return await this.categoriaService.findAll();
  }

  @Post()
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Crear una nueva categoría (admin)' })
  @ApiResponse({ status: 201, description: 'Categoría creada', type: Categoria })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin permiso de admin' })
  async create(@Body() dto: CreateCategoriaDTO): Promise<Categoria> {
    return await this.categoriaService.create(dto);
  }

  @Put(':id')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Actualizar una categoría (admin)' })
  @ApiParam({ name: 'id', description: 'UUID de la categoría' })
  @ApiResponse({ status: 200, description: 'Categoría actualizada', type: Categoria })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin permiso de admin' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  async update(@Param('id') id: string, @Body() dto: CreateCategoriaDTO): Promise<Categoria> {
    return await this.categoriaService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Eliminar una categoría (admin)' })
  @ApiParam({ name: 'id', description: 'UUID de la categoría' })
  @ApiResponse({ status: 200, description: 'Categoría eliminada correctamente' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin permiso de admin' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  async delete(@Param('id') id: string): Promise<void> {
    return await this.categoriaService.delete(id);
  }
}
