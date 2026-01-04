import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolEnum, User } from './user.entity';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@Req() req): Promise<User> {
    const decoded = req.user as { uid: string; email?: string; name?: string };
    return this.usersService.ensureFromFirebase({
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name as string | undefined
    });
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'moderator')
  findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles('admin')
  updateRole(@Param('id') id: string, @Body() body: UpdateRoleDto): Promise<User> {
    return this.usersService.updateRole(id, body.rol as RolEnum);
  }
}
