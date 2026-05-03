import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScrapingService } from './scraping.service';
import { ScrapingController } from './scraping.controller';
import { Event } from '../events/event.entity';
import { Categoria } from '../categorias/categoria.entity';
import { User } from '../users/user.entity';
import { Resena } from '../events/resena.entity';
import { Mensaje } from '../chat/mensaje.entity';
import { SevillaScraperService } from './scrapers/sevilla-scraper.service';
import { TicketmasterScraperService } from './scrapers/ticketmaster-scraper.service';
import { AuthModule } from '../auth/auth.module';
import { GeminiScraperService } from './scrapers/gemini-scraper.service';

@Module({
  imports: [TypeOrmModule.forFeature([Event, Categoria, User, Resena, Mensaje]), AuthModule],
  controllers: [ScrapingController],
  providers: [
    ScrapingService,
    SevillaScraperService,
    TicketmasterScraperService,
    GeminiScraperService,
  ],
  exports: [ScrapingService],
})
export class ScrapingModule {}
