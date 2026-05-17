import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { IScraper, ScrapedEvent } from '../interfaces/scraper.interface';

const BASE_URL = 'https://visitasevilla.es';
const LISTING_URL = `${BASE_URL}/ahora-en-sevilla/`;

// Coordenadas de Sevilla centro como fallback
const SEVILLA_LON = -5.9845;
const SEVILLA_LAT = 37.3891;

@Injectable()
export class VisitaSevillaScraperService implements IScraper {
  readonly name = 'visitasevilla';
  private readonly logger = new Logger(VisitaSevillaScraperService.name);

  async scrape(): Promise<ScrapedEvent[]> {
    this.logger.log(`Iniciando scraping de ${LISTING_URL}`);
    const html = await this.fetchHtml(LISTING_URL);
    if (!html) return [];

    const $ = cheerio.load(html);
    const events: ScrapedEvent[] = [];

    $('article.grid__block').each((_, el) => {
      try {
        const event = this.parseArticle($, el);
        if (event) events.push(event);
      } catch (err) {
        this.logger.warn(`Error parseando artículo: ${String(err)}`);
      }
    });

    this.logger.log(`visitasevilla: ${events.length} eventos extraídos`);
    return events;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseArticle($: cheerio.CheerioAPI, el: any): ScrapedEvent | null {
    const title = $(el).find('.block__title').text().trim();
    if (!title) return null;

    const rawFecha = $(el).find('.evento-fecha').text().trim();
    const category = $(el).find('.cat-item').first().text().trim();

    const imgStyle = $(el).find('.block__image').attr('style') || '';
    const imgMatch = imgStyle.match(/url\(['"]?([^'")\s]+)['"]?\)/);
    const imagen = imgMatch ? this.absoluteUrl(imgMatch[1]) : undefined;

    const linkHref = $(el).find('a').first().attr('href') || '';
    const sourceUrl = linkHref ? this.absoluteUrl(linkHref) : LISTING_URL;

    const { fechaInicio, fechaFin, hasMultipleDatesAvailable } = this.parseFecha(rawFecha, title);

    return {
      title,
      description: `${title}\n\nFuente: ${sourceUrl}`,
      address: 'Sevilla, España',
      location: { type: 'Point', coordinates: [SEVILLA_LON, SEVILLA_LAT] },
      fechaInicio,
      fechaFin,
      hasMultipleDatesAvailable,
      precio: null,
      precioMin: null,
      precioMax: null,
      categoriaHint: category || 'Otros',
      imagen,
      sourceUrl,
    };
  }

  // Parsea el formato DD.MM.YY o DD.MM.YY-DD.MM.YY de visitasevilla
  private parseFecha(
    raw: string,
    title: string
  ): { fechaInicio: Date | null; fechaFin: Date | null; hasMultipleDatesAvailable: boolean } {
    const empty = { fechaInicio: null, fechaFin: null, hasMultipleDatesAvailable: true };

    if (!raw) return empty;

    // Extraer una o dos fechas con regex para evitar ambigüedad con el guion separador
    const datePattern = /(\d{1,2}\.\d{1,2}\.\d{2,4})/g;
    const matches = raw.match(datePattern) ?? [];
    const startStr = matches[0];
    const endStr = matches[1];

    const fechaInicio = this.parseSingleDate(startStr ?? '');

    // Placeholder 01.01.70 = evento recurrente sin fecha concreta
    if (!fechaInicio || fechaInicio.getFullYear() < 2000) {
      this.logger.debug(`Evento sin fecha concreta (placeholder o inválido): ${title}`);
      return empty;
    }

    const fechaFin = endStr ? this.parseSingleDate(endStr) : null;

    // Si el rango supera 14 días, es un ciclo/temporada → "Consultar fechas"
    if (fechaFin && fechaInicio) {
      const diffDays = (fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 14) {
        this.logger.debug(
          `Evento con rango largo (${diffDays.toFixed(0)} días), marcado como múltiples fechas: ${title}`
        );
        return empty;
      }
    }

    return { fechaInicio, fechaFin, hasMultipleDatesAvailable: false };
  }

  // Parsea "DD.MM.YY" → Date local (sin hora inventada)
  private parseSingleDate(str: string): Date | null {
    if (!str) return null;
    const match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-indexed
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;

    if (month < 0 || month > 11 || day < 1 || day > 31) return null;

    return new Date(year, month, day, 12, 0, 0, 0); // mediodía local para evitar problemas de zona horaria
  }

  private absoluteUrl(url: string): string {
    if (!url) return '';
    if (/^https?:\/\//.test(url)) return url;
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  private async fetchHtml(url: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const resp = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        this.logger.error(`HTTP ${resp.status} al cargar ${url}`);
        return null;
      }
      return await resp.text();
    } catch (err) {
      this.logger.error(`Error fetching ${url}: ${String(err)}`);
      return null;
    }
  }
}
