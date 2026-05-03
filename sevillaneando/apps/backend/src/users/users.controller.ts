import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
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
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { TipoEnum } from '../notificaciones/enums/tipo.enum';
import { ThrottleUpload } from '../common/decorators/throttle-custom.decorator';

@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly notificacionesService: NotificacionesService,
  ) { }

  @Post('upload-profile-image/firebase')
  @ThrottleUpload()
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

  @Get('search')
  async search(@Query('q') q: string) {
    if (!q || q.trim().length < 2) return [];
    const users = await this.usersService.searchUsers(q.trim());
    return users.map((u) => ({ id: u.id, nombre: u.nombre, fotoPerfil: u.fotoPerfil }));
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

  @Post(':id/seguir')
  @UseGuards(FirebaseAuthGuard)
  async seguir(@Param('id') id: string, @Req() req: { user: { uid: string } }) {
    const yo = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!yo) return;
    const yaSeguia = await this.usersService.isSiguiendo(yo.id, id);
    await this.usersService.seguir(yo.id, id);
    if (!yaSeguia) {
      const seguido = await this.usersService.findById(id);
      if (seguido) {
        await this.notificacionesService.crearParaUsuario(
          seguido,
          `${yo.nombre} ha empezado a seguirte.`,
          TipoEnum.NuevoSeguidor,
        );
      }
    }
    return { siguiendo: true };
  }

  @Delete(':id/seguir')
  @UseGuards(FirebaseAuthGuard)
  async dejarDeSeguir(@Param('id') id: string, @Req() req: { user: { uid: string } }) {
    const yo = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!yo) return;
    await this.usersService.dejarDeSeguir(yo.id, id);
    return { siguiendo: false };
  }

  @Get(':id/siguiendo')
  @UseGuards(FirebaseAuthGuard)
  async checkSiguiendo(@Param('id') id: string, @Req() req: { user: { uid: string } }) {
    const yo = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!yo) return { siguiendo: false };
    const siguiendo = await this.usersService.isSiguiendo(yo.id, id);
    return { siguiendo };
  }

  @Get(':id/seguidos')
  async getSeguidos(@Param('id') id: string) {
    const users = await this.usersService.getSeguidos(id);
    return users.map((u) => ({ id: u.id, nombre: u.nombre, fotoPerfil: u.fotoPerfil }));
  }

  @Get(':id/seguidores')
  async getSeguidores(@Param('id') id: string) {
    const users = await this.usersService.getSeguidores(id);
    return users.map((u) => ({ id: u.id, nombre: u.nombre, fotoPerfil: u.fotoPerfil }));
  }
}
