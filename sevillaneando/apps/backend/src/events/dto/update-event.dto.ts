import { PartialType } from '@nestjs/mapped-types';
import { CreateEventDto } from './create-event.dto';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { GeoJsonPoint } from '../../common/geojson-point';
import { GeoJsonPointDto } from '../../common/geojson-point.dto';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ValidateNested({ message: 'La ubicación debe ser un punto GeoJSON válido.' })
  @Type(() => GeoJsonPointDto)
  @IsOptional()
  location?: GeoJsonPoint;
}
