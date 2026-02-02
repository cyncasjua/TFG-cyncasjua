import { Controller, Get, Post, Body, Delete, Param, Put } from '@nestjs/common';
import { Categoria } from '../entities/categoria.entity';
import { CreateCategoriaDTO } from './dto/create-categoria.dto';
import { CategoriasService } from './categorias.service';

@Controller('categorias')
export class CategoriasController {
  constructor(
    private readonly categoriaService: CategoriasService,
  ) {}

  @Get()
  async findAll() {
    return await this.categoriaService.findAll();
  }


  @Post()
  async create(@Body() dto: CreateCategoriaDTO): Promise<Categoria> {
    return await this.categoriaService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: CreateCategoriaDTO): Promise<Categoria> {
    return await this.categoriaService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<void> {
    return await this.categoriaService.delete(id);
  }
  
}