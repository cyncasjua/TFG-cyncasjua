import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScrapingService } from './scraping.service';
import { ScrapingController } from './scraping.controller';
import { Event } from '../events/event.entity';
import { Categoria } from '../entities/categoria.entity';
import { User } from '../users/user.entity';
import { SevillaScraperService } from './scrapers/sevilla-scraper.service';
import { TicketmasterScraperService } from './scrapers/ticketmaster-scraper.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Event, Categoria, User]), AuthModule],
  controllers: [ScrapingController],
  providers: [ScrapingService, SevillaScraperService, TicketmasterScraperService],
  exports: [ScrapingService],
})
export class ScrapingModule {}
