import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  NotFoundException,
  Patch,
} from '@nestjs/common';
import { RutasService } from './rutas.service';
import { CreateRutaDto } from './dto/create-ruta.dto';
import { UpdateRutaDto } from './dto/update-ruta.dto';
import { Ruta } from './ruta.entity';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { UsersService } from '../users/users.service';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

@ApiTags('Rutas')
@Controller('rutas')
export class RutasController {
  constructor(
    private readonly rutasService: RutasService,
    private readonly usersService: UsersService
  ) {}

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Crear una nueva ruta' })
  @ApiResponse({ status: 201, description: 'Ruta creada', type: Ruta })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async create(
    @Body() createRutaDto: CreateRutaDto,
    @Req() req: { user: { uid: string } }
  ): Promise<Ruta> {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.rutasService.create(createRutaDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar rutas (opcionalmente filtradas por usuario)' })
  @ApiQuery({ name: 'userId', required: false, description: 'UUID del usuario creador' })
  @ApiResponse({ status: 200, description: 'Lista de rutas', type: [Ruta] })
  async findAll(@Query('userId') userId?: string): Promise<Ruta[]> {
    return this.rutasService.findAll(userId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Buscar rutas por nombre' })
  @ApiQuery({ name: 'q', description: 'Texto de búsqueda' })
  @ApiResponse({ status: 200, description: 'Lista de rutas encontradas', type: [Ruta] })
  async search(@Query('q') query: string): Promise<Ruta[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }
    return this.rutasService.searchRutas(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una ruta por ID' })
  @ApiParam({ name: 'id', description: 'UUID de la ruta' })
  @ApiResponse({ status: 200, description: 'Ruta encontrada', type: Ruta })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  async findOne(@Param('id') id: string): Promise<Ruta> {
    return this.rutasService.findOne(id);
  }

  @Get(':id/mi-calificacion')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Obtener la calificación propia del usuario para una ruta' })
  @ApiParam({ name: 'id', description: 'UUID de la ruta' })
  @ApiResponse({ status: 200, description: 'Calificación del usuario (null si no ha calificado)', schema: { example: { calificacion: 4 } } })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getMyRating(
    @Param('id') id: string,
    @Req() req: { user: { uid: string } }
  ): Promise<{ calificacion: number | null }> {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const calificacion = await this.rutasService.getCalificacionUsuario(id, user.id);
    return { calificacion };
  }

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Actualizar una ruta (solo el creador)' })
  @ApiParam({ name: 'id', description: 'UUID de la ruta' })
  @ApiResponse({ status: 200, description: 'Ruta actualizada', type: Ruta })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (no es el creador)' })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  async update(
    @Param('id') id: string,
    @Body() updateRutaDto: UpdateRutaDto,
    @Req() req: { user: { uid: string } }
  ): Promise<Ruta> {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.rutasService.update(id, updateRutaDto, user.id);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Eliminar una ruta (solo el creador)' })
  @ApiParam({ name: 'id', description: 'UUID de la ruta' })
  @ApiResponse({ status: 200, description: 'Ruta eliminada correctamente' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No autorizado (no es el creador)' })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  async remove(@Param('id') id: string, @Req() req: { user: { uid: string } }): Promise<void> {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.rutasService.remove(id, user.id);
  }

  @Post(':id/calificar')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-jwt')
  @ApiOperation({ summary: 'Calificar una ruta' })
  @ApiParam({ name: 'id', description: 'UUID de la ruta' })
  @ApiResponse({ status: 201, description: 'Ruta con puntuación actualizada', type: Ruta })
  @ApiResponse({ status: 400, description: 'Puntuación fuera de rango' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Ruta no encontrada' })
  async rateRuta(
    @Param('id') id: string,
    @Body() { puntuacion }: { puntuacion: number },
    @Req() req: { user: { uid: string } }
  ): Promise<Ruta> {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.rutasService.rateRuta(id, puntuacion, user.id);
  }
}
