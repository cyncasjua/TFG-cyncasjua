import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { AxiosError } from 'axios';
import { IScraper, ScrapedEvent } from '../interfaces/scraper.interface';

//Scraper para eventos de Ticketmaster en Sevilla
@Injectable()
export class TicketmasterScraperService implements IScraper {
  readonly name = 'ticketmaster-sevilla';
  private readonly logger = new Logger(TicketmasterScraperService.name);

  //  API oficial de Ticketmaster
  private readonly API_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.getApiKey();
    const keyPresent = !!apiKey;
    const keyPreview = keyPresent ? apiKey.substring(0, 5) + '***' : 'NO CONFIGURADA';
    this.logger.log(`TicketmasterScraperService inicializado. API Key: ${keyPreview}`);
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];
    const apiKey = this.getApiKey();

    if (apiKey) {
      // Opción 1: Usar API oficial (RECOMENDADO)
      await this.scrapeWithApi(events, apiKey);
    } else {
      // Opción 2: Web scraping (solo si no hay API disponible)
      this.logger.warn('TICKETMASTER_API_KEY no configurada. Scraping deshabilitado.');
      this.logger.warn('Obtén tu API key en: https://developer.ticketmaster.com/');
    }

    return events;
  }

  /**
   * Método usando la API oficial de Ticketmaster
   */
  private async scrapeWithApi(events: ScrapedEvent[], apiKey: string): Promise<void> {
    try {
      this.logger.log(`Consultando Ticketmaster API con key: ${apiKey.substring(0, 5)}...`);
      const startDateTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

      const seenIds = new Set<string>();
      const pageSize = 100;
      const maxPages = 5;
      let page = 0;
      let totalPages = 1;

      while (page < totalPages && page < maxPages) {
        const response = await axios.get(this.API_URL, {
          params: {
            apikey: apiKey,
            countryCode: 'ES',
            latlong: '37.3891,-5.9845',
            radius: 80,
            unit: 'km',
            size: pageSize,
            page,
            sort: 'date,asc',
            locale: '*',
            startDateTime,
          },
          timeout: 15000,
        });

        totalPages = Math.max(1, Number(response.data?.page?.totalPages) || 1);
        const pageEvents = response.data?._embedded?.events ?? [];

        this.logger.log(
          `Ticketmaster página ${page + 1}/${Math.min(totalPages, maxPages)}: ${pageEvents.length} eventos`,
        );

        for (const event of pageEvents) {
          try {
            if (!event?.id || seenIds.has(String(event.id))) continue;
            seenIds.add(String(event.id));

            const scrapedEvent = this.parseTicketmasterEvent(event);
            if (scrapedEvent) {
              events.push(scrapedEvent);
            }
          } catch (error) {
            this.logger.error(`Error parseando evento ${event?.name ?? 'desconocido'}:`, error);
          }
        }

        page += 1;
      }

      this.logger.log(`Ticketmaster: ${events.length} eventos procesados exitosamente`);
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const statusText = axiosError.response?.statusText;
      const responseData = axiosError.response?.data;
      const message = axiosError.message || 'Error desconocido';

      this.logger.error(
        `Error scrapeando Ticketmaster API: ${status ?? 'N/A'} ${statusText ?? ''} - ${message}`.trim(),
      );

      if (responseData) {
        this.logger.warn(`Detalle Ticketmaster API: ${JSON.stringify(responseData)}`);
      }
    }
  }

  private getApiKey(): string {
    return this.configService.get<string>('TICKETMASTER_API_KEY') || process.env.TICKETMASTER_API_KEY || '';
  }

  /**
   * Parsea un evento de la API de Ticketmaster
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseTicketmasterEvent(tmEvent: any): ScrapedEvent | null {
    try {
      // Extraer información básica
      const title = tmEvent.name;
      const description = tmEvent.info || tmEvent.description || tmEvent.pleaseNote || 'Sin descripción';

      // Fechas
      const fechaInicio = new Date(tmEvent.dates.start.dateTime || tmEvent.dates.start.localDate);
      let fechaFin = new Date(fechaInicio);

      if (tmEvent.dates.end?.dateTime) {
        fechaFin = new Date(tmEvent.dates.end.dateTime);
      } else {
        // Si no hay fecha fin, asumir 2 horas después del inicio
        fechaFin.setHours(fechaFin.getHours() + 2);
      }

      // Ubicación
      const venue = tmEvent._embedded?.venues?.[0];
      const address = venue?.address?.line1 || 'Sevilla, España';
      const lat = parseFloat(venue?.location?.latitude || '37.3891');
      const lng = parseFloat(venue?.location?.longitude || '-5.9845');

      // Precio
      let precio: number | null = null;
      let precioMin: number | null = null;
      let precioMax: number | null = null;

      if (tmEvent.priceRanges && tmEvent.priceRanges.length > 0) {
        precioMin = tmEvent.priceRanges[0].min;
        precioMax = tmEvent.priceRanges[0].max;
        precio = precioMin; // O el promedio si prefieres
      }

      // Imagen
      const imagen = tmEvent.images?.[0]?.url;

      return {
        title,
        description,
        address,
        location: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        fechaInicio,
        fechaFin,
        precio,
        precioMin,
        precioMax,
        imagen,
        sourceUrl: tmEvent.url,
        externalId: `ticketmaster-${tmEvent.id}`,
      };
    } catch (error) {
      this.logger.error('Error parseando evento de Ticketmaster:', error);
      return null;
    }
  }
}
