import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Categoria } from './categoria.entity';
import { Repository } from 'typeorm';
import { CreateCategoriaDTO } from './dto/create-categoria.dto';
import { User } from '../users/user.entity';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>
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
      .orderBy("CASE WHEN LOWER(TRIM(categoria.nombre)) = 'otros' THEN 1 ELSE 0 END", 'ASC')
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
    const oldNombre = categoria.nombre;
    const newNombre = dto.nombre;
    categoria.nombre = newNombre;
    categoria.descripcion = dto.descripcion;
    const updated = await this.categoriaRepo.save(categoria);

    if (oldNombre !== newNombre) {
      await this.renameInteresInUsers(oldNombre, newNombre);
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const categoria = await this.categoriaRepo.findOneBy({ id });
    if (!categoria) return;

    await this.removeCategoriafromUsers(id, categoria.nombre);
    await this.categoriaRepo.delete(id);
  }

  private async renameInteresInUsers(oldNombre: string, newNombre: string): Promise<void> {
    const users = await this.userRepo.find();
    const toUpdate = users.filter((u) => u.intereses.includes(oldNombre));
    if (toUpdate.length === 0) return;

    await Promise.all(
      toUpdate.map((u) => {
        u.intereses = u.intereses.map((i) => (i === oldNombre ? newNombre : i));
        return this.userRepo.save(u);
      })
    );
  }

  private async removeCategoriafromUsers(
    categoriaId: string,
    categoriaName: string
  ): Promise<void> {
    const users = await this.userRepo.find();
    const toUpdate = users.filter(
      (u) => u.intereses.includes(categoriaName) || u.categoryOrder.includes(categoriaId)
    );
    if (toUpdate.length === 0) return;

    await Promise.all(
      toUpdate.map((u) => {
        u.intereses = u.intereses.filter((i) => i !== categoriaName);
        u.categoryOrder = u.categoryOrder.filter((id) => id !== categoriaId);
        return this.userRepo.save(u);
      })
    );
  }
}
