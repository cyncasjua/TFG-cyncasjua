import { Controller, Post, Get, Param, UseGuards, Logger } from '@nestjs/common';
import { ScrapingService } from './scraping.service';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ThrottleStrict } from '../common/decorators/throttle-custom.decorator';

@Controller('scraping')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ScrapingController {
  private readonly logger = new Logger(ScrapingController.name);
  constructor(private readonly scrapingService: ScrapingService) {}

  @Post('run-all')
  @Roles('admin')
  @ThrottleStrict()
  async runAllScrapers() {
    const result = await this.scrapingService.scrapeAll();
    return {
      message: 'Scraping completado',
      ...result,
    };
  }

  @Post('reset')
  @Roles('admin')
  @ThrottleStrict()
  async resetScrapedEvents() {
    this.logger.log('POST /scraping/reset llamado');
    try {
      const result = await this.scrapingService.resetScrapedEvents();
      this.logger.log(`POST /scraping/reset ok: ${JSON.stringify(result)}`);
      return {
        message: 'Reset completado: eventos scrapeados eliminados y regenerados',
        ...result,
      };
    } catch (err) {
      this.logger.error('POST /scraping/reset ERROR:', err);
      throw err;
    }
  }

  @Post('run/:scraperName')
  @Roles('admin')
  @ThrottleStrict()
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
