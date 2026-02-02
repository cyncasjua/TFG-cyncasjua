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
  @IsString({ message: 'El nombre debe ser un texto.' })
  @Length(2, 120, { message: 'El nombre debe tener entre 2 y 120 caracteres.' })
  nombre?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El email debe ser una dirección válida.' })
  @MaxLength(180, { message: 'El email no puede superar los 180 caracteres.' })
  email?: string;

  @IsOptional()
  @ValidateNested({ message: 'La ubicación debe ser un punto GeoJSON válido.' })
  @Type(() => GeoJsonPoint)
  ubicacion?: GeoJsonPoint;

  @IsOptional()
  @IsString({ message: 'La foto de perfil debe ser un texto.' })
  @MaxLength(512, { message: 'La URL de la foto no puede superar los 512 caracteres.' })
  fotoPerfil?: string;

  @IsOptional()
  @IsArray({ message: 'Los intereses deben ser un array.' })
  @IsString({ each: true, message: 'Cada interés debe ser un texto.' })
  intereses?: string[];
}
