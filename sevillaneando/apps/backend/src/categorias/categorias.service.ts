import { Inject, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Categoria } from "src/entities/categoria.entity";
import { Repository } from "typeorm";
import { CreateCategoriaDTO } from "./dto/create-categoria.dto";

@Injectable()
export class CategoriasService {
    constructor(
        @InjectRepository(Categoria)
        private readonly categoriaRepo: Repository<Categoria>
    ) { }

    async create(dto: CreateCategoriaDTO): Promise<Categoria> {
        const nuevaCategoria = this.categoriaRepo.create({
            nombre: dto.nombre,
            descripcion: dto.descripcion
        });
        return await this.categoriaRepo.save(nuevaCategoria);
    }

    async findAll(): Promise<Categoria[]> {
        return await this.categoriaRepo.find();
    }
}

