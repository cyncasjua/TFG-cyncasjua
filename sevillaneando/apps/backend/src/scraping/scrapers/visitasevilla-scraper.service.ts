import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { IScraper, ScrapedEvent } from '../interfaces/scraper.interface';

const BASE_URL = 'https://visitasevilla.es';
const LISTING_URL = `${BASE_URL}/ahora-en-sevilla/`;

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

    const articles = $('article.grid__block').toArray();
    this.logger.log(`visitasevilla: ${articles.length} artículos encontrados en el listado`);

    for (const el of articles) {
      try {
        const event = await this.parseArticle($, el);
        if (event) events.push(event);
      } catch (err) {
        this.logger.warn(`Error parseando artículo: ${String(err)}`);
      }
    }

    this.logger.log(`visitasevilla: ${events.length} eventos extraídos`);
    return events;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async parseArticle($: cheerio.CheerioAPI, el: any): Promise<ScrapedEvent | null> {
    const title = $(el).find('.block__title').text().trim();
    if (!title) return null;

    const rawFecha = $(el).find('.evento-fecha').text().trim();
    const category = $(el).find('.cat-item').first().text().trim();

    // Imagen del listado
    const imgStyle = $(el).find('.block__image').attr('style') || '';
    const imgMatch = imgStyle.match(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/i);
    const imagenListado = imgMatch?.[1] ? this.absoluteUrl(imgMatch[1]) : undefined;

    const linkHref = $(el).find('a').first().attr('href') || '';
    const sourceUrl = linkHref ? this.absoluteUrl(linkHref) : LISTING_URL;

    const { fechaInicio, fechaFin, hasMultipleDatesAvailable } = this.parseFecha(rawFecha, title);

    // Visitar página de detalle para obtener dirección, precio, coordenadas y descripción
    const detail = await this.fetchDetail(sourceUrl);

    return {
      title,
      description: detail.description || `${title}\n\nFuente: ${sourceUrl}`,
      address: detail.address || 'Sevilla, España',
      location: detail.location || { type: 'Point', coordinates: [-5.9845, 37.3891] },
      fechaInicio,
      fechaFin,
      hasMultipleDatesAvailable,
      precio: detail.precio,
      precioMin: null,
      precioMax: null,
      categoriaHint: category || 'Otros',
      imagen: detail.imagen || imagenListado,
      sourceUrl,
    };
  }

  private async fetchDetail(url: string): Promise<{
    description: string;
    address: string;
    location: { type: 'Point'; coordinates: [number, number] } | null;
    precio: number | null;
    imagen: string | undefined;
  }> {
    const empty = {
      description: '',
      address: 'Sevilla, España',
      location: null,
      precio: null,
      imagen: undefined,
    };
    const html = await this.fetchHtml(url);
    if (!html) return empty;

    const $ = cheerio.load(html);

    // Imagen de la página de detalle (más fiable que el listado)
    const imagenSrc = $('.evento-imagen').attr('src');
    const imagen = imagenSrc ? this.absoluteUrl(imagenSrc) : undefined;

    // Coordenadas del iframe de Google Maps: ?q=37.389,-5.974
    let location: { type: 'Point'; coordinates: [number, number] } | null = null;
    const mapSrc = $('.evento-mapa').attr('src') || '';
    const coordMatch = mapSrc.match(/[?&]q=([-\d.]+),\s*([-\d.]+)/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        location = { type: 'Point', coordinates: [lon, lat] };
      }
    }

    // Dirección: texto tras "Dirección:" dentro de .evento-descripcion
    let address = 'Sevilla, España';
    const descHtml = $('.evento-descripcion').html() || '';
    const dirMatch = descHtml.match(/Direcci[oó]n[:\s]*<\/b>([\s\S]*?)<\/p>/i);
    if (dirMatch) {
      const dirText = cheerio.load(dirMatch[1]).text().replace(/\s+/g, ' ').trim();
      if (dirText.length > 3) address = dirText;
    }

    // Precio: texto tras "Tarifas:" — capturar el texto plano que lo sigue
    let precio: number | null = null;
    const tarifaMatch = descHtml.match(/Tarifas[:\s]*<\/b>([\s\S]*?)(?:<div><b>|<p><b>|$)/i);
    if (tarifaMatch) {
      const tarifaText = cheerio.load(tarifaMatch[1]).text().replace(/\s+/g, ' ').trim();
      // Si dice "gratuito", "gratis", "entrada libre" → precio 0
      if (/gratu[íi]to|gratis|entrada libre|free|sin cargo/i.test(tarifaText)) {
        precio = 0;
      }
      // Si menciona un número de euros → extraer el primero
      const euroMatch = tarifaText.match(/(\d+(?:[.,]\d+)?)\s*(?:€|euros?)/i);
      if (euroMatch) {
        precio = parseFloat(euroMatch[1].replace(',', '.'));
      }
    }
    // También buscar en el título: "Desde 17 euros"
    if (precio === null) {
      const titleEuroMatch = url.match(/desde-(\d+)-euros/i);
      if (titleEuroMatch) precio = parseFloat(titleEuroMatch[1]);
    }

    // Descripción: texto limpio de .evento-descripcion quitando la parte de Dirección/Tarifas/Horario
    const descText = $('.evento-descripcion').text().replace(/\s+/g, ' ').trim().substring(0, 800);

    const description = `${descText}\n\nFuente: ${url}`;

    return { description, address, location, precio, imagen };
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

  // Parsea "DD.MM.YY" → Date local al mediodía (evita problemas de zona horaria)
  private parseSingleDate(str: string): Date | null {
    if (!str) return null;
    const match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;

    if (month < 0 || month > 11 || day < 1 || day > 31) return null;

    return new Date(year, month, day, 12, 0, 0, 0);
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
