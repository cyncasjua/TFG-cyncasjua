import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScrapingService } from '../scraping/scraping.service';

@Injectable()
export class ScrapingScheduler {
  private readonly logger = new Logger(ScrapingScheduler.name);

  constructor(private readonly scrapingService: ScrapingService) {
    this.executeScraping('arranque');
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyScraping() {
    this.executeScraping('programado');
  }

  private async executeScraping(source: string) {
    this.logger.log(`Iniciando scraping automático (${source})...`);

    try {
      const result = await this.scrapingService.scrapeAll();
      this.logger.log(
        `Scraping ${source} completado: ${result.total} eventos encontrados, ` +
          `${result.saved} guardados, ${result.errors} errores`
      );
    } catch (error) {
      this.logger.error(`Error durante el scraping ${source}:`, error);
    }
  }
}
