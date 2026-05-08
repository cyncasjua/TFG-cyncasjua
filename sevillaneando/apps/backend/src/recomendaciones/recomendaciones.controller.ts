import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { UsersService } from '../users/users.service';
import { RecomendacionesService } from './recomendaciones.service';
import { RateEventDto } from './dto/rate-event.dto';
import type { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

type AuthRequest = Request & { user: { uid: string } };

@ApiTags('Recomendaciones')
@ApiBearerAuth('firebase-jwt')
@Controller('recomendaciones')
@UseGuards(FirebaseAuthGuard)
export class RecomendacionesController {
  constructor(
    private readonly usersService: UsersService,
    private readonly recomendacionesService: RecomendacionesService
  ) {}

  private async resolveUserId(req: AuthRequest): Promise<string> {
    const user = await this.usersService.findByFirebaseUid(req.user.uid);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user.id;
  }

  @Post('events/:eventId/guardar')
  @ApiOperation({ summary: 'Guardar un evento en favoritos' })
  @ApiParam({ name: 'eventId', description: 'UUID del evento' })
  @ApiResponse({ status: 201, description: 'Evento guardado correctamente' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async saveEvent(@Req() req: AuthRequest, @Param('eventId', ParseUUIDPipe) eventId: string) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.saveEvent(userId, eventId);
  }

  @Delete('events/:eventId/guardar')
  @ApiOperation({ summary: 'Quitar un evento de favoritos' })
  @ApiParam({ name: 'eventId', description: 'UUID del evento' })
  @ApiResponse({ status: 200, description: 'Evento eliminado de favoritos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async unsaveEvent(@Req() req: AuthRequest, @Param('eventId', ParseUUIDPipe) eventId: string) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.unsaveEvent(userId, eventId);
  }

  @Post('events/:eventId/compartir')
  @ApiOperation({ summary: 'Registrar que el usuario ha compartido un evento' })
  @ApiParam({ name: 'eventId', description: 'UUID del evento' })
  @ApiResponse({ status: 201, description: 'Interacción de compartir registrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async shareEvent(@Req() req: AuthRequest, @Param('eventId', ParseUUIDPipe) eventId: string) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.shareEvent(userId, eventId);
  }

  @Post('events/:eventId/visitar')
  @ApiOperation({ summary: 'Registrar que el usuario ha visitado la página de un evento' })
  @ApiParam({ name: 'eventId', description: 'UUID del evento' })
  @ApiResponse({ status: 201, description: 'Visita registrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async visitEvent(@Req() req: AuthRequest, @Param('eventId', ParseUUIDPipe) eventId: string) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.visitEvent(userId, eventId);
  }

  @Post('events/:eventId/valorar')
  @ApiOperation({ summary: 'Valorar un evento (puntuación y comentario)' })
  @ApiParam({ name: 'eventId', description: 'UUID del evento' })
  @ApiResponse({ status: 201, description: 'Valoración registrada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async rateEvent(
    @Req() req: AuthRequest,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: RateEventDto
  ) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.rateEvent(userId, eventId, body);
  }

  @Get('events/:eventId/valorar/me')
  @ApiOperation({ summary: 'Obtener la valoración propia del usuario para un evento' })
  @ApiParam({ name: 'eventId', description: 'UUID del evento' })
  @ApiResponse({ status: 200, description: 'Valoración propia (null si no ha valorado)', schema: { example: { puntuacion: 4, comentario: 'Muy bien' } } })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getMyEventRating(
    @Req() req: AuthRequest,
    @Param('eventId', ParseUUIDPipe) eventId: string
  ) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.getMyEventRating(userId, eventId);
  }

  @Get('me/events')
  @ApiOperation({ summary: 'Obtener eventos recomendados para el usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de eventos recomendados ordenados por puntuación' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiQuery({ name: 'lat', required: false, description: 'Latitud del usuario' })
  @ApiQuery({ name: 'lng', required: false, description: 'Longitud del usuario' })
  @ApiQuery({ name: 'radiusKm', required: false, description: 'Radio de búsqueda en km' })
  @ApiQuery({ name: 'from', required: false, description: 'Fecha inicio del filtro (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'Fecha fin del filtro (ISO 8601)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Número máximo de resultados' })
  async recommendEvents(
    @Req() req: AuthRequest,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string
  ) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.recommendEvents(userId, {
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      radiusKm: radiusKm ? Number(radiusKm) : undefined,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('me/guardados')
  @ApiOperation({ summary: 'Obtener eventos guardados en favoritos por el usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de eventos guardados' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async getSavedEvents(@Req() req: AuthRequest) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.getSavedEvents(userId);
  }

  @Get('me/rutas')
  @ApiOperation({ summary: 'Obtener rutas recomendadas para el usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de rutas recomendadas generadas automáticamente' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiQuery({ name: 'lat', required: false, description: 'Latitud del usuario' })
  @ApiQuery({ name: 'lng', required: false, description: 'Longitud del usuario' })
  @ApiQuery({ name: 'radiusKm', required: false, description: 'Radio de búsqueda en km' })
  @ApiQuery({ name: 'from', required: false, description: 'Fecha inicio del filtro (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'Fecha fin del filtro (ISO 8601)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Número máximo de eventos candidatos' })
  @ApiQuery({ name: 'routesLimit', required: false, description: 'Número máximo de rutas devueltas' })
  @ApiQuery({ name: 'minEventsPerRoute', required: false, description: 'Mínimo de eventos por ruta' })
  @ApiQuery({ name: 'maxEventsPerRoute', required: false, description: 'Máximo de eventos por ruta' })
  @ApiQuery({ name: 'strategy', required: false, description: 'Estrategia: walkable | score | balanced' })
  @ApiQuery({ name: 'maxGapMinutes', required: false, description: 'Tiempo máximo entre eventos (minutos)' })
  @ApiQuery({ name: 'maxOverlapMinutes', required: false, description: 'Solapamiento máximo permitido (minutos)' })
  async recommendRoutes(
    @Req() req: AuthRequest,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('routesLimit') routesLimit?: string,
    @Query('minEventsPerRoute') minEventsPerRoute?: string,
    @Query('maxEventsPerRoute') maxEventsPerRoute?: string,
    @Query('strategy') strategy?: string,
    @Query('maxGapMinutes') maxGapMinutes?: string,
    @Query('maxOverlapMinutes') maxOverlapMinutes?: string
  ) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.recommendRoutes(userId, {
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      radiusKm: radiusKm ? Number(radiusKm) : undefined,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
      routesLimit: routesLimit ? Number(routesLimit) : undefined,
      minEventsPerRoute: minEventsPerRoute ? Number(minEventsPerRoute) : undefined,
      maxEventsPerRoute: maxEventsPerRoute ? Number(maxEventsPerRoute) : undefined,
      strategy:
        strategy === 'walkable' || strategy === 'score' || strategy === 'balanced'
          ? strategy
          : undefined,
      maxGapMinutes: maxGapMinutes ? Number(maxGapMinutes) : undefined,
      maxOverlapMinutes: maxOverlapMinutes ? Number(maxOverlapMinutes) : undefined,
    });
  }
}
