import {
  IsOptional,
  IsString,
  IsEmail,
  Length,
  MaxLength,
  IsArray,
  IsNumber,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type { GeoJsonPoint } from '../../common/geojson-point';
import { GeoJsonPointDto } from '../../common/geojson-point.dto';
import {
  InteresCategoriaEnum,
  normalizeIntereses,
} from '../enums/interes-categoria.enum';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto.' })
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  nombre?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El email debe ser una dirección válida.' })
  @MaxLength(180, { message: 'El email no puede superar los 180 caracteres.' })
  email?: string;

  @IsOptional()
  @ValidateNested({ message: 'La ubicación debe ser un punto GeoJSON válido.' })
  @Type(() => GeoJsonPointDto)
  ubicacion?: GeoJsonPoint;

  @IsOptional()
  @IsString({ message: 'La foto de perfil debe ser un texto.' })
  @MaxLength(512, { message: 'La URL de la foto no puede superar los 512 caracteres.' })
  fotoPerfil?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeIntereses(value))
  @IsArray({ message: 'Los intereses deben ser un array.' })
  @IsEnum(InteresCategoriaEnum, {
    each: true,
    message: 'Cada interés debe ser una categoría válida.',
  })
  intereses?: InteresCategoriaEnum[];

  @IsOptional()
  @IsArray({ message: 'El orden de categorías debe ser un array.' })
  @IsString({ each: true, message: 'Cada categoría debe ser un texto.' })
  categoryOrder?: string[];

  @IsOptional()
  @IsArray({ message: 'Las opciones de radio deben ser un array.' })
  @IsNumber({}, { each: true, message: 'Cada radio debe ser un número.' })
  @Type(() => Number)
  radiusOptions?: number[];
}
