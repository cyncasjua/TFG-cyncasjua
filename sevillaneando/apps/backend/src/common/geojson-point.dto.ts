import { IsNumber, IsString } from 'class-validator';
import type { GeoJsonPoint } from './geojson-point';

export class GeoJsonPointDto implements GeoJsonPoint {
  @IsString()
  type!: 'Point';

  @IsNumber({}, { each: true })
  coordinates!: [number, number];
}
