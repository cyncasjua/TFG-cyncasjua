import { Body, Controller, Get, Param, Patch, Req, UseGuards,Post, UseInterceptors, UploadedFile, Request,Delete } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolEnum, User } from './user.entity';
import { UsersService } from './users.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { Multer } from 'multer';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('upload-profile-image/firebase')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/profile-images',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      }
    })
  }))
  uploadProfileImageFirebase(@UploadedFile() file: Multer.File) {
    return { url: `/uploads/profile-images/${file.filename}` };
  }

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

  @Patch('me/firebase')
  async updateMeFirebase(@Req() req, @Body() body: UpdateProfileDto): Promise<User> {
    const decoded = req.user as { uid: string };
    return this.usersService.updateProfile(decoded.uid, body);
  }

  @Delete('me/firebase')
  @UseGuards(FirebaseAuthGuard)
  async deleteMeFirebase(@Request() req) {
    await this.usersService.deleteByFirebaseUid(req.user.uid);
    return { message: 'Cuenta eliminada correctamente' };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.usersService.deleteCompletelyById(id);
    return { success: true };
  }
}
