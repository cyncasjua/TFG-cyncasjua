import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

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

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}
