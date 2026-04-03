import { IsInt, Max, Min, IsString, Length } from 'class-validator';

export class RateEventDto {
  @IsInt({ message: 'La puntuacion debe ser un numero entero.' })
  @Min(1, { message: 'La puntuacion minima es 1.' })
  @Max(5, { message: 'La puntuacion maxima es 5.' })
  puntuacion!: number;

  @IsString({ message: 'El comentario debe ser un texto.' })
  @Length(10, 500, { message: 'El comentario debe tener entre 10 y 500 caracteres.' })
  comentario!: string;
}
