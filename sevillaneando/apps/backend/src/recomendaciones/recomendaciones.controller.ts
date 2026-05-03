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

type AuthRequest = Request & { user: { uid: string } };

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
  async saveEvent(@Req() req: AuthRequest, @Param('eventId', ParseUUIDPipe) eventId: string) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.saveEvent(userId, eventId);
  }

  @Delete('events/:eventId/guardar')
  async unsaveEvent(@Req() req: AuthRequest, @Param('eventId', ParseUUIDPipe) eventId: string) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.unsaveEvent(userId, eventId);
  }

  @Post('events/:eventId/compartir')
  async shareEvent(@Req() req: AuthRequest, @Param('eventId', ParseUUIDPipe) eventId: string) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.shareEvent(userId, eventId);
  }

  @Post('events/:eventId/visitar')
  async visitEvent(@Req() req: AuthRequest, @Param('eventId', ParseUUIDPipe) eventId: string) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.visitEvent(userId, eventId);
  }

  @Post('events/:eventId/valorar')
  async rateEvent(
    @Req() req: AuthRequest,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: RateEventDto
  ) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.rateEvent(userId, eventId, body);
  }

  @Get('events/:eventId/valorar/me')
  async getMyEventRating(
    @Req() req: AuthRequest,
    @Param('eventId', ParseUUIDPipe) eventId: string
  ) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.getMyEventRating(userId, eventId);
  }

  @Get('me/events')
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
  async getSavedEvents(@Req() req: AuthRequest) {
    const userId = await this.resolveUserId(req);
    return this.recomendacionesService.getSavedEvents(userId);
  }

  @Get('me/rutas')
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
