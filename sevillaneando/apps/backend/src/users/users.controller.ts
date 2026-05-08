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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';


@ApiTags('Usuarios')
@ApiBearerAuth('firebase-jwt')
@Controller('users')
@UseGuards(FirebaseAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly notificacionesService: NotificacionesService
  ) {}

  @Post('upload-profile-image/firebase')
  @ThrottleUpload()
  @ApiOperation({ summary: 'Subir imagen de perfil' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: 201, description: 'URL de la imagen subida', schema: { example: { url: 'https://res.cloudinary.com/...' } } })
  @ApiResponse({ status: 400, description: 'Archivo no proporcionado o formato no permitido' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
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
  @ApiOperation({ summary: 'Buscar usuarios por nombre' })
  @ApiQuery({ name: 'q', description: 'Texto de búsqueda (mínimo 2 caracteres)' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios encontrados', schema: { example: [{ id: 'uuid', nombre: 'Ana', fotoPerfil: null }] } })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async search(@Query('q') q: string) {
    if (!q || q.trim().length < 2) return [];
    const users = await this.usersService.searchUsers(q.trim());
    return users.map((u) => ({ id: u.id, nombre: u.nombre, fotoPerfil: u.fotoPerfil }));
  }

  @Get('me')
  @ApiOperation({ summary: 'Obtener o crear el perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil del usuario autenticado', type: User })
  @ApiResponse({ status: 401, description: 'No autenticado' })
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
  @ApiOperation({ summary: 'Listar todos los usuarios (admin/moderator)' })
  @ApiResponse({ status: 200, description: 'Lista completa de usuarios', type: [User] })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin permiso de admin/moderator' })
  findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Cambiar el rol de un usuario (admin)' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario con rol actualizado', type: User })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin permiso de admin' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  updateRole(@Param('id') id: string, @Body() body: UpdateRoleDto): Promise<User> {
    return this.usersService.updateRole(id, body.rol as RolEnum);
  }

  @Patch('me/firebase')
  @ApiOperation({ summary: 'Actualizar el perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil actualizado', type: User })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async updateMeFirebase(
    @Req() req: { user: { uid: string } },
    @Body() body: UpdateProfileDto
  ): Promise<User> {
    const decoded = req.user;
    return this.usersService.updateProfile(decoded.uid, body);
  }

  @Delete('me/firebase')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Eliminar la propia cuenta del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Cuenta eliminada', schema: { example: { message: 'Cuenta eliminada correctamente' } } })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async deleteMeFirebase(@Request() req: { user: { uid: string } }) {
    await this.usersService.deleteByFirebaseUid(req.user.uid);
    return { message: 'Cuenta eliminada correctamente' };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar un usuario por ID (admin)' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiResponse({ status: 200, description: 'Usuario eliminado', schema: { example: { success: true } } })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin permiso de admin' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async remove(@Param('id') id: string) {
    await this.usersService.deleteCompletelyById(id);
    return { success: true };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener perfil público de un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiResponse({ status: 200, description: 'Perfil público del usuario', schema: { example: { id: 'uuid', nombre: 'Ana', fotoPerfil: null, intereses: [] } } })
  @ApiResponse({ status: 401, description: 'No autenticado' })
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
  @ApiOperation({ summary: 'Seguir a un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario a seguir' })
  @ApiResponse({ status: 201, description: 'Ahora sigues al usuario', schema: { example: { siguiendo: true } } })
  @ApiResponse({ status: 401, description: 'No autenticado' })
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
          TipoEnum.NuevoSeguidor
        );
      }
    }
    return { siguiendo: true };
  }

  @Delete(':id/seguir')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Dejar de seguir a un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiResponse({ status: 200, description: 'Has dejado de seguir al usuario', schema: { example: { siguiendo: false } } })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async dejarDeSeguir(@Param('id') id: string, @Req() req: { user: { uid: string } }) {
    const yo = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!yo) return;
    await this.usersService.dejarDeSeguir(yo.id, id);
    return { siguiendo: false };
  }

  @Get(':id/siguiendo')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Comprobar si el usuario actual sigue a otro usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario a comprobar' })
  @ApiResponse({ status: 200, description: 'Estado de seguimiento', schema: { example: { siguiendo: true } } })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async checkSiguiendo(@Param('id') id: string, @Req() req: { user: { uid: string } }) {
    const yo = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!yo) return { siguiendo: false };
    const siguiendo = await this.usersService.isSiguiendo(yo.id, id);
    return { siguiendo };
  }

  @Get(':id/seguidos')
  @ApiOperation({ summary: 'Listar usuarios a los que sigue un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios seguidos', schema: { example: [{ id: 'uuid', nombre: 'Ana', fotoPerfil: null }] } })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getSeguidos(@Param('id') id: string) {
    const users = await this.usersService.getSeguidos(id);
    return users.map((u) => ({ id: u.id, nombre: u.nombre, fotoPerfil: u.fotoPerfil }));
  }

  @Get(':id/seguidores')
  @ApiOperation({ summary: 'Listar seguidores de un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de seguidores', schema: { example: [{ id: 'uuid', nombre: 'Ana', fotoPerfil: null }] } })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getSeguidores(@Param('id') id: string) {
    const users = await this.usersService.getSeguidores(id);
    return users.map((u) => ({ id: u.id, nombre: u.nombre, fotoPerfil: u.fotoPerfil }));
  }
}
