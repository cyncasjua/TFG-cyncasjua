import {
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsString,
  IsOptional,
  ValidateNested,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ArrayMaxSize,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrenciaEnum } from '../enums/recurrencia.enum';
import { Type } from 'class-transformer';
import { IsEndDateAfterStartDate } from './is-end-date-after-start-date.decorator';
import type { GeoJsonPoint } from '../../common/geojson-point';
import { GeoJsonPointDto } from '../../common/geojson-point.dto';

export class CreateEventDto {
  @ApiProperty({ description: 'Título del evento', minLength: 3, maxLength: 100 })
  @IsString({ message: 'El título debe ser un texto.' })
  @IsNotEmpty({ message: 'El título es obligatorio.' })
  @Length(3, 100, { message: 'El título debe tener entre 3 y 100 caracteres.' })
  title!: string;

  @ApiProperty({ description: 'Descripción del evento', minLength: 10, maxLength: 1000 })
  @IsString({ message: 'La descripción debe ser un texto.' })
  @IsNotEmpty({ message: 'La descripción es obligatoria.' })
  @Length(10, 1000, { message: 'La descripción debe tener entre 10 y 1000 caracteres.' })
  description!: string;

  @ApiProperty({ description: 'Dirección del evento', maxLength: 255 })
  @IsString({ message: 'La dirección debe ser un texto.' })
  @IsNotEmpty({ message: 'La dirección es obligatoria.' })
  @MaxLength(255, { message: 'La dirección no puede superar los 255 caracteres.' })
  address!: string;

  @ApiProperty({ description: 'Ubicación GeoJSON del evento', type: () => GeoJsonPointDto })
  @ValidateNested({ message: 'La ubicación debe ser un punto GeoJSON válido.' })
  @Type(() => GeoJsonPointDto)
  @IsNotEmpty({ message: 'La ubicación es obligatoria.' })
  location!: GeoJsonPoint;

  @ApiPropertyOptional({ description: 'Fecha de inicio (ISO 8601)', example: '2025-06-15T18:00:00Z' })
  @IsDateString({}, { message: 'La fecha de inicio debe tener un formato válido.' })
  @IsOptional()
  fechaInicio?: string;

  @ApiPropertyOptional({ description: 'Fecha de fin (ISO 8601, posterior a fechaInicio)', example: '2025-06-15T22:00:00Z' })
  @IsDateString({}, { message: 'La fecha de fin debe tener un formato válido.' })
  @IsOptional()
  @IsEndDateAfterStartDate('fechaInicio', {
    message: 'La fecha de fin debe ser posterior a la fecha de inicio.',
  })
  fechaFin?: string;

  @ApiPropertyOptional({ description: 'Precio de entrada (0 = gratuito)', minimum: 0 })
  @IsNumber({}, { message: 'El precio debe ser un número.' })
  @Min(0, { message: 'El precio no puede ser negativo.' })
  @IsOptional()
  precio!: number;

  @ApiPropertyOptional({ description: 'Precio mínimo (rango de precios)', minimum: 0 })
  @IsNumber({}, { message: 'El precio mínimo debe ser un número.' })
  @Min(0, { message: 'El precio mínimo no puede ser negativo.' })
  @IsOptional()
  precioMin?: number;

  @ApiPropertyOptional({ description: 'Precio máximo (rango de precios)', minimum: 0 })
  @IsNumber({}, { message: 'El precio máximo debe ser un número.' })
  @Min(0, { message: 'El precio máximo no puede ser negativo.' })
  @IsOptional()
  precioMax?: number;

  @ApiPropertyOptional({ description: 'Si el evento es privado (requiere link de acceso)' })
  @IsBoolean({ message: 'El campo privado debe ser un valor booleano.' })
  @IsOptional()
  privado?: boolean;

  @ApiPropertyOptional({ description: 'Token de acceso para eventos privados', maxLength: 255 })
  @IsString({ message: 'El link de acceso debe ser un texto.' })
  @MaxLength(255, { message: 'El link de acceso no puede superar los 255 caracteres.' })
  @IsOptional()
  linkAcceso?: string;

  @ApiProperty({ description: 'UUID de la categoría del evento' })
  @IsUUID()
  @IsNotEmpty()
  categoriaId!: string;

  @ApiProperty({ description: 'UUID del usuario creador del evento' })
  @IsUUID()
  @IsNotEmpty()
  creadorId!: string;

  @ApiPropertyOptional({ description: 'Estado del evento (pendiente, aprobado, rechazado)' })
  @IsString()
  @IsOptional()
  estado?: string;

  @ApiPropertyOptional({ description: 'URL de la imagen principal del evento', maxLength: 512 })
  @IsString()
  @IsOptional()
  @MaxLength(512)
  imagen?: string;

  @ApiPropertyOptional({ description: 'URLs de imágenes adicionales (máximo 5)', type: [String] })
  @IsOptional()
  @ArrayMaxSize(5, { message: 'Solo se pueden añadir hasta 5 imágenes por evento' })
  @IsString({ each: true })
  imagenes?: string[];

  @ApiPropertyOptional({ description: 'Tipo de recurrencia del evento', enum: RecurrenciaEnum })
  @IsEnum(RecurrenciaEnum, { message: 'Tipo de recurrencia no válido.' })
  @IsOptional()
  recurrencia?: RecurrenciaEnum;

  @ApiPropertyOptional({ description: 'Fecha de fin de la recurrencia (ISO 8601)', example: '2025-12-31T00:00:00Z' })
  @IsDateString({}, { message: 'La fecha fin de recurrencia debe tener un formato válido.' })
  @IsOptional()
  recurrenciaFin?: string;
}
