import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Categoria } from '../entities/categoria.entity';
import { Repository } from 'typeorm';
import { CreateCategoriaDTO } from './dto/create-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>
  ) {}

  async create(dto: CreateCategoriaDTO): Promise<Categoria> {
    const nuevaCategoria = this.categoriaRepo.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
    });
    return await this.categoriaRepo.save(nuevaCategoria);
  }

  async findAll(): Promise<Categoria[]> {
    return await this.categoriaRepo
      .createQueryBuilder('categoria')
      .orderBy('CASE WHEN LOWER(TRIM(categoria.nombre)) = \'otros\' THEN 1 ELSE 0 END', 'ASC')
      .addOrderBy('categoria.nombre', 'ASC')
      .getMany();
  }

  async findById(id: string): Promise<Categoria | null> {
    return await this.categoriaRepo.findOneBy({ id: id.toString() });
  }

  async update(id: string, dto: CreateCategoriaDTO): Promise<Categoria> {
    const categoria = await this.categoriaRepo.findOneBy({ id: id.toString() });
    if (!categoria) {
      throw new Error(`Categoría con ID ${id} no encontrada.`);
    }
    categoria.nombre = dto.nombre;
    categoria.descripcion = dto.descripcion;
    return await this.categoriaRepo.save(categoria);
  }

  async delete(id: string): Promise<void> {
    await this.categoriaRepo.delete(id);
  }
}
