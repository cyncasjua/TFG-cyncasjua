import { PartialType } from '@nestjs/mapped-types';
import { CreateEventDto } from './create-event.dto';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class GeoJsonPoint {
  type: 'Point';

  coordinates: [number, number];
}

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ValidateNested()
  @Type(() => GeoJsonPoint)
  @IsOptional()
  location?: GeoJsonPoint;
}
