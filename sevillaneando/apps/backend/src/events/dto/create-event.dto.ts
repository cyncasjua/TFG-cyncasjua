import { IsNotEmpty, IsNumber, IsString, IsDateString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class GeoJsonPoint {
  @IsString()
  type!: 'Point';

  @IsNumber({}, { each: true })
  coordinates!: [number, number]; 
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @ValidateNested()
  @Type(() => GeoJsonPoint)
  @IsNotEmpty()
  location!: GeoJsonPoint;

  @IsDateString()
  @IsOptional()
  fechaInicio?: string;

  @IsDateString()
  @IsOptional()
  fechaFin?: string;

  @IsNumber()
  @IsOptional()
  precio?: number;

  @IsString()
  @IsOptional()
  estado?: string;

  @IsNumber()
  @IsOptional()
  categoriaId?: number;

  @IsNumber()
  @IsOptional()
  creadorId?: number;

  @IsString()
  @IsOptional()
  imagen?: string;
}