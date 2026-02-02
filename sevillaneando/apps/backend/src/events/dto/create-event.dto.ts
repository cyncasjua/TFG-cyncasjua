import { IsNotEmpty, IsNumber, IsString, IsDateString, IsOptional, ValidateNested, IsUUID, Length, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { IsEndDateAfterStartDate } from './is-end-date-after-start-date.decorator';

class GeoJsonPoint {
  @IsString()
  type!: 'Point';

  @IsNumber({}, { each: true })
  coordinates!: [number, number]; 
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 1000)
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
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
  @IsEndDateAfterStartDate('fechaInicio', { message: 'La fecha de fin debe ser posterior a la fecha de inicio.' })
  fechaFin!: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
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
  @MaxLength(512)
  imagen?: string;
}