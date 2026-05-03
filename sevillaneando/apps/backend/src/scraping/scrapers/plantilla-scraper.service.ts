import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { IScraper, ScrapedEvent } from '../interfaces/scraper.interface';

@Injectable()
export class PlantillaScraperService implements IScraper {
  readonly name = 'plantilla-ejemplo';
  private readonly logger = new Logger(PlantillaScraperService.name);

  // URL de la página a scrapear
  private readonly BASE_URL = 'https://ejemplo.com/eventos';

  async scrape(): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];

    try {
      // PASO 1: Obtener el HTML de la página
      const html = await this.fetchPage(this.BASE_URL);

      // PASO 2: Parsear el HTML con Cheerio
      const $ = cheerio.load(html);

      // PASO 3: Extraer eventos (selector CSS)
      const eventElements = $('.evento-card');

      this.logger.log(`Encontrados ${eventElements.length} eventos en la página`);

      // PASO 4: Iterar sobre cada evento
      eventElements.each((index, element) => {
        try {
          const scrapedEvent = this.parseEventElement($, element);
          if (this.isValidEvent(scrapedEvent)) {
            events.push(scrapedEvent);
          }
        } catch (error) {
          this.logger.error(`Error parseando evento ${index + 1}:`, error);
        }
      });
    } catch (error) {
      this.logger.error('Error durante el scraping:', error);
    }

    return events;
  }

  //Obtiene el HTML de una página

  private async fetchPage(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9',
        },
        timeout: 10000,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Error obteniendo página ${url}:`, error);
      throw error;
    }
  }

  private parseEventElement($: cheerio.CheerioAPI, element: Element): ScrapedEvent {
    const $el = $(element);

    // Extraer campos
    const title = this.extractText($el, '.titulo-evento');
    const description = this.extractText($el, '.descripcion');
    const fecha = this.extractText($el, '.fecha');
    const hora = this.extractText($el, '.hora');
    const direccion = this.extractText($el, '.lugar');
    const precioTexto = this.extractText($el, '.precio');
    const imagen = this.extractAttribute($el, '.imagen img', 'src');
    const enlace = this.extractAttribute($el, 'a', 'href');

    // Procesar datos
    const fechaInicio = this.parseFecha(fecha, hora);
    const fechaFin = this.parseFecha(fecha, hora);

    const precio = this.extraerPrecio(precioTexto);
    const location = this.geocodificarDireccion(direccion);

    return {
      title,
      description: description || 'Sin descripción disponible',
      address: direccion || 'Sevilla',
      location,
      fechaInicio,
      fechaFin,
      precio,
      imagen: imagen ? this.normalizarUrl(imagen) : undefined,
      sourceUrl: enlace ? this.normalizarUrl(enlace) : this.BASE_URL,
      externalId: `${this.name}-${this.generateId(title, fecha)}`,
    };
  }

  //Extrae texto de un elemento con selector CSS
  private extractText($el: cheerio.Cheerio<Element>, selector: string): string {
    return $el.find(selector).first().text().trim();
  }

  //Extrae atributo de un elemento
  private extractAttribute(
    $el: cheerio.Cheerio<Element>,
    selector: string,
    attribute: string
  ): string {
    return $el.find(selector).first().attr(attribute)?.trim() || '';
  }

  //Parsea una fecha desde texto (varia segun la página)
  private parseFecha(fechaTexto: string, horaTexto: string = ''): Date {
    const date = new Date();

    const match = fechaTexto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      date.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    const horaMatch = horaTexto.match(/(\d{1,2}):(\d{2})/);
    if (horaMatch) {
      const [, hour, minute] = horaMatch;
      date.setHours(parseInt(hour), parseInt(minute), 0, 0);
    }

    return date;
  }

  //Extrae precio desde texto
  private extraerPrecio(texto: string): number | null {
    if (!texto) return null;

    const match = texto.replace(',', '.').match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : null;
  }

  //Geocodifica una dirección (o retorna coordenadas por defecto)
  private geocodificarDireccion(direccion: string): {
    type: 'Point';
    coordinates: [number, number];
  } {
    // Por defecto: Centro de Sevilla
    let lat = 37.3891;
    let lng = -5.9845;

    if (direccion.toLowerCase().includes('plaza españa')) {
      lat = 37.3772;
      lng = -5.9867;
    } else if (direccion.toLowerCase().includes('catedral')) {
      lat = 37.3858;
      lng = -5.9934;
    }

    return {
      type: 'Point',
      coordinates: [lng, lat],
    };
  }

  //Normaliza URLs relativas a absolutas
  private normalizarUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    try {
      const base = new URL(this.BASE_URL);
      return new URL(url, base.origin).toString();
    } catch (err) {
      this.logger.debug(`No se pudo normalizar URL "${url}": ${String(err)}`);
      return url;
    }
  }

  //Genera ID único para un evento

  private generateId(title: string, fecha: string): string {
    const str = `${title}-${fecha}`.toLowerCase().replace(/\s+/g, '-');
    return str.substring(0, 50);
  }

  //Valida que un evento tenga los campos mínimos requeridos

  private isValidEvent(event: ScrapedEvent): boolean {
    if (!event.title || event.title.length < 3) {
      this.logger.warn('Evento sin título válido');
      return false;
    }

    if (!event.fechaInicio || isNaN(event.fechaInicio.getTime())) {
      this.logger.warn(`Evento "${event.title}" sin fecha válida`);
      return false;
    }

    return true;
  }
}
