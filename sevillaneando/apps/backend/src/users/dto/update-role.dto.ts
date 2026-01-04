import { IsEnum, IsNotEmpty } from 'class-validator';
import { RolEnum } from '../user.entity';

export class UpdateRoleDto {
  @IsNotEmpty()
  @IsEnum(RolEnum)
  rol!: RolEnum;
}