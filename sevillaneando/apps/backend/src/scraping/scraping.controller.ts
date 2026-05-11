import { Controller, Post, Get, Param, UseGuards, Logger } from '@nestjs/common';
import { ScrapingService } from './scraping.service';
import { FirebaseAuthGuard } from '../auth/firebase.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ThrottleStrict } from '../common/decorators/throttle-custom.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@ApiTags('Scraping')
@ApiBearerAuth('firebase-jwt')
@Controller('scraping')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ScrapingController {
  private readonly logger = new Logger(ScrapingController.name);
  constructor(private readonly scrapingService: ScrapingService) {}

  @Post('run-all')
  @Roles('admin')
  @ThrottleStrict()
  @ApiOperation({ summary: 'Ejecutar todos los scrapers (admin)' })
  @ApiResponse({
    status: 200,
    description: 'Scrapers ejecutados',
    schema: { example: { message: 'Scraping completado' } },
  })
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
  @ApiOperation({ summary: 'Eliminar y regenerar todos los eventos scrapeados (admin)' })
  @ApiResponse({
    status: 200,
    description: 'Reset completado',
    schema: {
      example: { message: 'Reset completado: eventos scrapeados eliminados y regenerados' },
    },
  })
  @ApiResponse({ status: 500, description: 'Error durante el reset' })
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
  @ApiOperation({ summary: 'Ejecutar un scraper concreto por nombre (admin)' })
  @ApiParam({ name: 'scraperName', description: 'Nombre del scraper a ejecutar' })
  @ApiResponse({
    status: 200,
    description: 'Scraper ejecutado',
    schema: { example: { message: 'Scraper "example" ejecutado' } },
  })
  async runScraper(@Param('scraperName') scraperName: string) {
    const result = await this.scrapingService.scrapeByName(scraperName);
    return {
      message: `Scraper "${scraperName}" ejecutado`,
      ...result,
    };
  }

  @Get('scrapers')
  @Roles('admin')
  @ApiOperation({ summary: 'Listar scrapers disponibles (admin)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de scrapers',
    schema: { example: { scrapers: ['scraperA', 'scraperB'] } },
  })
  getScrapers() {
    return {
      scrapers: this.scrapingService.getAvailableScrapers(),
    };
  }

  @Post('delete-all-events')
  @ApiOperation({ summary: 'Eliminar todos los eventos (solo entorno no-producción)' })
  @ApiResponse({
    status: 200,
    description: 'Eventos eliminados',
    schema: { example: { message: 'Todos los eventos han sido eliminados' } },
  })
  @ApiResponse({ status: 403, description: 'No disponible en producción' })
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
