import { IsOptional, IsString, IsEmail, Length, MaxLength, IsArray, ArrayNotEmpty, IsUrl } from 'class-validator';

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
  @IsString()
  @MaxLength(255)
  ubicacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  fotoPerfil?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  intereses?: string[];
}