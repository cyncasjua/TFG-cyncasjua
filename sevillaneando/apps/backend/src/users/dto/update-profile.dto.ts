import {
  IsOptional,
  IsString,
  IsEmail,
  Length,
  MaxLength,
  IsArray,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import type { GeoJsonPoint } from '../../common/geojson-point';
import { GeoJsonPointDto } from '../../common/geojson-point.dto';
import { normalizeIntereses } from '../enums/interes-categoria.enum';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Nombre del usuario', minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto.' })
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  nombre?: string;

  @ApiPropertyOptional({ description: 'Email del usuario', maxLength: 180 })
  @IsOptional()
  @IsEmail({}, { message: 'El email debe ser una dirección válida.' })
  @MaxLength(180, { message: 'El email no puede superar los 180 caracteres.' })
  email?: string;

  @ApiPropertyOptional({ description: 'Ubicación GeoJSON del usuario', type: () => GeoJsonPointDto })
  @IsOptional()
  @ValidateNested({ message: 'La ubicación debe ser un punto GeoJSON válido.' })
  @Type(() => GeoJsonPointDto)
  ubicacion?: GeoJsonPoint;

  @ApiPropertyOptional({ description: 'URL de la foto de perfil', maxLength: 512 })
  @IsOptional()
  @IsString({ message: 'La foto de perfil debe ser un texto.' })
  @MaxLength(512, { message: 'La URL de la foto no puede superar los 512 caracteres.' })
  fotoPerfil?: string;

  @ApiPropertyOptional({ description: 'Categorías de interés del usuario', type: [String] })
  @IsOptional()
  @Transform(({ value }) => normalizeIntereses(value))
  @IsArray({ message: 'Los intereses deben ser un array.' })
  @IsString({ each: true, message: 'Cada interés debe ser un texto.' })
  intereses?: string[];

  @ApiPropertyOptional({ description: 'Orden preferido de categorías en la UI', type: [String] })
  @IsOptional()
  @IsArray({ message: 'El orden de categorías debe ser un array.' })
  @IsString({ each: true, message: 'Cada categoría debe ser un texto.' })
  categoryOrder?: string[];

  @ApiPropertyOptional({ description: 'Radios de búsqueda personalizados (km)', type: [Number] })
  @IsOptional()
  @IsArray({ message: 'Las opciones de radio deben ser un array.' })
  @IsNumber({}, { each: true, message: 'Cada radio debe ser un número.' })
  @Type(() => Number)
  radiusOptions?: number[];
}
