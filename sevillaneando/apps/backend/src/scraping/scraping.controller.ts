import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { ScrapingService } from './scraping.service';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('scraping')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ScrapingController {
  constructor(private readonly scrapingService: ScrapingService) {}


  @Post('run-all')
  @Roles('admin')
  async runAllScrapers() {
    const result = await this.scrapingService.scrapeAll();
    return {
      message: 'Scraping completado',
      ...result,
    };
  }

  @Post('run/:scraperName')
  @Roles('admin')
  async runScraper(@Param('scraperName') scraperName: string) {
    const result = await this.scrapingService.scrapeByName(scraperName);
    return {
      message: `Scraper "${scraperName}" ejecutado`,
      ...result,
    };
  }

  @Get('scrapers')
  @Roles('admin')
  getScrapers() {
    return {
      scrapers: this.scrapingService.getAvailableScrapers(),
    };
  }

  @Post('delete-all-events')
  async deleteAllEvents() {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'No disponible en producción' };
    }
    const result = await this.scrapingService.deleteAllEvents();
    return {
      message: 'Todos los eventos han sido eliminados',
      ...result,
    };
  }
}
