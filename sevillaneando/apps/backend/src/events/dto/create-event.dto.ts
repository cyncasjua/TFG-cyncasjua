import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  ValidateNested,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsEndDateAfterStartDate } from './is-end-date-after-start-date.decorator';
import type { GeoJsonPoint } from '../../common/geojson-point';
import { GeoJsonPointDto } from '../../common/geojson-point.dto';

export class CreateEventDto {
  @IsString({ message: 'El título debe ser un texto.' })
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  @Length(3, 100, { message: 'El título debe tener entre 3 y 100 caracteres.' })
  title!: string;

  @IsString({ message: 'La descripción debe ser un texto.' })
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  @Length(10, 1000, { message: 'La descripción debe tener entre 10 y 1000 caracteres.' })
  description!: string;

  @IsString({ message: 'La dirección debe ser un texto.' })
  @IsNotEmpty({ message: 'La dirección es obligatoria.' })
  @MaxLength(255, { message: 'La dirección no puede superar los 255 caracteres.' })
  address!: string;

  @ValidateNested({ message: 'La ubicación debe ser un punto GeoJSON válido.' })
  @Type(() => GeoJsonPointDto)
  @IsNotEmpty({ message: 'La ubicación es obligatoria.' })
  location!: GeoJsonPoint;

  @IsNotEmpty({ message: 'La fecha de inicio es obligatoria.' })
  fechaInicio!: string;

  @IsNotEmpty({ message: 'La fecha de fin es obligatoria.' })
  @IsEndDateAfterStartDate('fechaInicio', {
    message: 'La fecha de fin debe ser posterior a la fecha de inicio.',
  })
  fechaFin!: string;

  @IsNumber({}, { message: 'El precio debe ser un número.' })
  @Min(0, { message: 'El precio no puede ser negativo.' })
  @IsOptional()
  precio!: number;

  @IsNumber({}, { message: 'El precio mínimo debe ser un número.' })
  @Min(0, { message: 'El precio mínimo no puede ser negativo.' })
  @IsOptional()
  precioMin?: number;

  @IsNumber({}, { message: 'El precio máximo debe ser un número.' })
  @Min(0, { message: 'El precio máximo no puede ser negativo.' })
  @IsOptional()
  precioMax?: number;

  @IsUUID()
  @IsNotEmpty()
  categoriaId!: string;

  @IsUUID()
  @IsNotEmpty()
  creadorId!: string;

  @IsString()
  @IsOptional()
  estado?: string;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  imagen?: string;
}
