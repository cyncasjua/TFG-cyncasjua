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
import { Ruta } from '../entities/ruta.entity';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { UsersService } from '../users/users.service';

@Controller('rutas')
export class RutasController {
  constructor(
    private readonly rutasService: RutasService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @UseGuards(FirebaseAuthGuard)
  async create(@Body() createRutaDto: CreateRutaDto, @Req() req: { user: { uid: string } }): Promise<Ruta> {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.rutasService.create(createRutaDto, user.id);
  }

  @Get()
  async findAll(@Query('userId') userId?: string): Promise<Ruta[]> {
    return this.rutasService.findAll(userId);
  }

  @Get('search')
  async search(@Query('q') query: string): Promise<Ruta[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }
    return this.rutasService.searchRutas(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Ruta> {
    return this.rutasService.findOne(id);
  }

  @Get(':id/mi-calificacion')
  @UseGuards(FirebaseAuthGuard)
  async getMyRating(
    @Param('id') id: string,
    @Req() req: { user: { uid: string } },
  ): Promise<{ calificacion: number | null }> {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const calificacion = await this.rutasService.getCalificacionUsuario(id, user.id);
    return { calificacion };
  }

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateRutaDto: UpdateRutaDto,
    @Req() req: { user: { uid: string } },
  ): Promise<Ruta> {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.rutasService.update(id, updateRutaDto, user.id);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  async remove(@Param('id') id: string, @Req() req: { user: { uid: string } }): Promise<void> {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.rutasService.remove(id, user.id);
  }

  @Post(':id/calificar')
  @UseGuards(FirebaseAuthGuard)
  async rateRuta(
    @Param('id') id: string,
    @Body() { puntuacion }: { puntuacion: number },
    @Req() req: { user: { uid: string } },
  ): Promise<Ruta> {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.rutasService.rateRuta(id, puntuacion, user.id);
  }
}
