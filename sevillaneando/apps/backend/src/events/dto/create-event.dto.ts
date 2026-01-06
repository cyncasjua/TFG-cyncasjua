import { IsNotEmpty, IsNumber, IsString, IsDateString, IsOptional, ValidateNested, IsUUID } from 'class-validator';
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
  @IsNotEmpty()
  fechaInicio!: string;

  @IsDateString()
  @IsNotEmpty()
  fechaFin!: string;

  @IsNumber()
  @IsNotEmpty()
  precio!: number;

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
  imagen?: string;
}