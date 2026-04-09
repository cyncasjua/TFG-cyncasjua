import { IsString, IsNotEmpty, IsArray, IsOptional, IsNumber, IsInt, Min, ArrayNotEmpty } from 'class-validator';
import type { GeoJsonPoint } from '../../common/geojson-point';

export class CreateRutaDto {
  @IsString()
  @IsNotEmpty()
  titulo!: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsArray()
  @ArrayNotEmpty()
  trayecto!: GeoJsonPoint[];

  @IsArray()
  @ArrayNotEmpty()
  eventosIds!: string[];

  @IsNumber()
  @IsInt()
  @Min(1)
  temporizacion!: number;
}
