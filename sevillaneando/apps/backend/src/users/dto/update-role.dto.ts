import { IsEnum, IsNotEmpty } from 'class-validator';
import { RolEnum } from '../enums/rol.enum';

export class UpdateRoleDto {
  @IsNotEmpty({ message: 'El rol es obligatorio.' })
  @IsEnum(RolEnum, {
    message: 'El rol debe ser uno de los valores válidos: user, moderator, admin.',
  })
  rol!: RolEnum;
}
