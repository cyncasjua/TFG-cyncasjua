import { IsString, IsNotEmpty, Length } from 'class-validator';

export class CreateCategoriaDTO {
  @IsString({ message: 'El nombre debe ser un texto.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @Length(3, 100, { message: 'El nombre debe tener entre 3 y 100 caracteres.' })
  nombre: string;

  @IsString({ message: 'La descripción debe ser un texto.' })
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  @Length(5, 200, { message: 'La descripción debe tener entre 5 y 200 caracteres.' })
  descripcion: string;
}

