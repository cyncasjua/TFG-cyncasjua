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
      await this.scrapeWithApi(events, apiKey);
    } else {
      this.logger.warn('TICKETMASTER_API_KEY no configurada. Scraping deshabilitado.');
      this.logger.warn('Obtén tu API key en: https://developer.ticketmaster.com/');
    }

    return events;
  }

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
            radius: 20,
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


  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseTicketmasterEvent(tmEvent: any): ScrapedEvent | null {
    try {
      const title = tmEvent.name;
      let description = '';
      if (typeof tmEvent.info === 'string' && tmEvent.info.trim().length > 0) {
        description = tmEvent.info.trim();
      }
      if (!description && typeof tmEvent.description === 'string' && tmEvent.description.trim().length > 0) {
        description = tmEvent.description.trim();
      }
      if (!description && typeof tmEvent.pleaseNote === 'string' && tmEvent.pleaseNote.trim().length > 0) {
        description = tmEvent.pleaseNote.trim();
      }
      if (!description || description.trim().length === 0) {
        description = 'Más información y venta de entradas en Ticketmaster';
      }

      const fechaInicio = this.parseTicketmasterDateTime(
        tmEvent.dates.start?.dateTime,
        tmEvent.dates.start?.localDate,
        tmEvent.dates.start?.localTime,
      );
      let fechaFin: Date | null = null;

      fechaFin = this.parseTicketmasterDateTime(
        tmEvent.dates.end?.dateTime,
        tmEvent.dates.end?.localDate,
        tmEvent.dates.end?.localTime,
      );

      // No inventar fechaFin si no existe - dejar como null
      if (fechaInicio && fechaFin && fechaFin.getTime() <= fechaInicio.getTime()) {
        fechaFin = null;
      }

      const venue = tmEvent._embedded?.venues?.[0];
      const city = venue?.city?.name || '';
      const stateCode = venue?.state?.stateCode || '';
      const address = venue?.address?.line1 || 'Sevilla, España';
      const lat = venue?.location?.latitude ? parseFloat(venue.location.latitude) : null;
      const lng = venue?.location?.longitude ? parseFloat(venue.location.longitude) : null;

      // Si no hay coordenadas exactas, descartar evento
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        this.logger.debug(`Evento descartado por falta de coordenadas exactas: ${title}`);
        return null;
      }

      // Filtrar eventos que no sean de Sevilla ciudad
      const cityLower = city.toLowerCase();
      const isSevillaCity = cityLower.includes('sevilla') || cityLower.includes('seville');
      if (!isSevillaCity) {
        this.logger.debug(`Evento descartado por ciudad fuera de Sevilla: ${title} (${city}, ${stateCode})`);
        return null;
      }

      const safeLat = lat as number;
      const safeLng = lng as number;
      const coordinates: [number, number] = [safeLng, safeLat];

      let precio: number | null = null;
      let precioMin: number | null = null;
      let precioMax: number | null = null;

      if (tmEvent.priceRanges && tmEvent.priceRanges.length > 0) {
        precioMin = tmEvent.priceRanges[0].min;
        precioMax = tmEvent.priceRanges[0].max;
        precio = precioMin;
      }

      const imagen = tmEvent.images?.[0]?.url;

      return {
        title,
        description,
        address,
        location: {
          type: 'Point',
          coordinates,
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

  private parseTicketmasterDateTime(
    dateTime?: string,
    localDate?: string,
    localTime?: string,
  ): Date | null {
    if (dateTime) {
      const parsedDateTime = new Date(dateTime);
      if (!Number.isNaN(parsedDateTime.getTime())) {
        return parsedDateTime;
      }
    }

    if (!localDate) {
      return null;
    }

    const dateMatch = localDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      return null;
    }

    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);

    const timeMatch = (localTime || '00:00:00').match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    const hour = timeMatch ? Number(timeMatch[1]) : 0;
    const minute = timeMatch ? Number(timeMatch[2]) : 0;
    const second = timeMatch?.[3] ? Number(timeMatch[3]) : 0;

    const offsetMinutes = this.getSevillaOffsetMinutesForLocalDate(year, month - 1, day);
    const utcMillis = Date.UTC(year, month - 1, day, hour, minute, second, 0) - offsetMinutes * 60 * 1000;
    const parsedLocalDate = new Date(utcMillis);

    if (Number.isNaN(parsedLocalDate.getTime())) {
      return null;
    }

    return parsedLocalDate;
  }

  private getSevillaOffsetMinutesForLocalDate(year: number, monthIndex: number, day: number): number {
    const middayUtc = new Date(Date.UTC(year, monthIndex, day, 12, 0, 0, 0));
    return this.isSevillaDst(middayUtc) ? 120 : 60;
  }

  private getLastSundayOfMonth(year: number, monthIndex: number): number {
    const lastDayUtc = new Date(Date.UTC(year, monthIndex + 1, 0));
    const dayOfWeek = lastDayUtc.getUTCDay();
    return lastDayUtc.getUTCDate() - dayOfWeek;
  }

  private isSevillaDst(utcDate: Date): boolean {
    const year = utcDate.getUTCFullYear();
    const marchLastSunday = this.getLastSundayOfMonth(year, 2);
    const octoberLastSunday = this.getLastSundayOfMonth(year, 9);

    const dstStartUtc = Date.UTC(year, 2, marchLastSunday, 1, 0, 0, 0);
    const dstEndUtc = Date.UTC(year, 9, octoberLastSunday, 1, 0, 0, 0);
    const currentUtc = utcDate.getTime();

    return currentUtc >= dstStartUtc && currentUtc < dstEndUtc;
  }
}
