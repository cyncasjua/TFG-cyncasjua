import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
  Post,
  UseInterceptors,
  UploadedFile,
  Request,
  Delete,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UpdateRoleDto } from './dto/update-role.dto';
import { User } from './user.entity';
import { RolEnum } from './enums/rol.enum';
import { UsersService } from './users.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService
  ) { }

  @Post('upload-profile-image/firebase')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
        if (!allowed.includes(file.mimetype)) {
          return cb(new BadRequestException('Formato no permitido'), false);
        }
        return cb(null, true);
      },
    })
  )
  async uploadProfileImageFirebase(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido');

    const uploaded = await this.cloudinaryService.uploadImage(file.buffer, {
      folder: 'sevillaneando/profile-images',
      publicIdPrefix: 'profile',
    });

    return { url: uploaded.optimizedUrl };
  }

  private getFirebaseUser(req: { user: { uid: string; email?: string; name?: string } }) {
    return req.user;
  }

  @Get('me')
  async me(@Req() req: { user: { uid: string; email?: string; name?: string } }): Promise<User> {
    const decoded = this.getFirebaseUser(req);
    return this.usersService.ensureFromFirebase({
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name as string | undefined,
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
  async updateMeFirebase(@Req() req: { user: { uid: string } }, @Body() body: UpdateProfileDto): Promise<User> {
    const decoded = req.user;
    return this.usersService.updateProfile(decoded.uid, body);
  }

  @Delete('me/firebase')
  @UseGuards(FirebaseAuthGuard)
  async deleteMeFirebase(@Request() req: { user: { uid: string } }) {
    await this.usersService.deleteByFirebaseUid(req.user.uid);
    return { message: 'Cuenta eliminada correctamente' };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: string) {
    await this.usersService.deleteCompletelyById(id);
    return { success: true };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      nombre: user.nombre,
      fotoPerfil: user.fotoPerfil,
      intereses: user.intereses,
    };
  }
}
