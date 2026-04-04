import { IsInt, Max, Min, IsOptional, IsString, MaxLength } from 'class-validator';

export class RateEventDto {
  @IsInt({ message: 'La puntuacion debe ser un numero entero.' })
  @Min(1, { message: 'La puntuacion minima es 1.' })
  @Max(5, { message: 'La puntuacion maxima es 5.' })
  puntuacion!: number;

  @IsOptional()
  @IsString({ message: 'El comentario debe ser un texto.' })
  @MaxLength(500, { message: 'El comentario no puede superar 500 caracteres.' })
  comentario?: string;
}
