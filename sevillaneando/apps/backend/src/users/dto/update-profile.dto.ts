import {
  IsOptional,
  IsString,
  IsEmail,
  Length,
  MaxLength,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

class GeoJsonPoint {
  @IsString()
  type!: 'Point';

  @IsNumber({}, { each: true })
  coordinates!: [number, number];
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  nombre?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  email?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoJsonPoint)
  ubicacion?: GeoJsonPoint;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  fotoPerfil?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  intereses?: string[];
}
