import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GeoJsonPointDto } from '../../common/geojson-point.dto';

export class EventEditRequestDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @ValidateNested()
  @Type(() => GeoJsonPointDto)
  @IsOptional()
  location?: GeoJsonPointDto;

  @IsString()
  @IsOptional()
  fechaInicio?: string;

  @IsString()
  @IsOptional()
  fechaFin?: string;

  @IsNumber()
  @IsOptional()
  precio?: number;

  @IsNumber()
  @IsOptional()
  precioMin?: number;

  @IsNumber()
  @IsOptional()
  precioMax?: number;

  @IsBoolean()
  @IsOptional()
  privado?: boolean;

  @IsString()
  @IsOptional()
  linkAcceso?: string;

  @IsString()
  @IsOptional()
  imagen?: string;

  @IsArray()
  @IsOptional()
  imagenes?: string[];
}
