import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { IScraper, ScrapedEvent } from '../interfaces/scraper.interface';

type JsonRecord = Record<string, unknown>;
type ParsedDateInfo = { date: Date; hasTime: boolean };


@Injectable()
export class SevillaScraperService implements IScraper {
  readonly name = 'sevilla-events';
  private readonly logger = new Logger(SevillaScraperService.name);
  private readonly EVENTBRITE_SEVILLA_URL = 'https://www.eventbrite.es/d/spain--sevilla/events/';
  private readonly AGENDA_SEVILLA_URL = 'https://www.sevilla.org/eventos';
  private readonly AGENDA_SEVILLA_RSS_URL = 'https://www.sevilla.org/eventos/eventos/RSS';

  constructor() {
    this.logger.log('SevillaScraperService inicializado');
  }

  async scrape(): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];

    try {
      await this.scrapeEventbriteSevilla(events);
      this.logger.log(`Después de Eventbrite: ${events.length} eventos totales`);
    } catch (error) {
      this.logger.error('Error en scrapeEventbriteSevilla:', error);
    }

    try {
      const agendaCountBefore = events.length;
      await this.scrapeAgendaSevilla(events);
      this.logger.log(`Agenda Sevilla añadió ${events.length - agendaCountBefore} eventos`);
    } catch (error) {
      this.logger.error('Error en scrapeAgendaSevilla:', error);
    }

    return events;
  }

  private async scrapeEventbriteSevilla(events: ScrapedEvent[]): Promise<void> {
    try {
      const response = await axios.get(this.EVENTBRITE_SEVILLA_URL, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const jsonLdScripts = $('script[type="application/ld+json"]');

      if (!jsonLdScripts.length) {
        this.logger.warn('No se encontraron scripts JSON-LD en Eventbrite');
        return;
      }

      const rawEvents: JsonRecord[] = [];

      jsonLdScripts.each((_, element) => {
        const raw = $(element).html() || '';
        if (!raw) return;

        try {
          const data = JSON.parse(raw);
          rawEvents.push(...this.extractEventsFromJsonLd(data));
        } catch (error) {
          this.logger.warn('No se pudo parsear un bloque JSON-LD de Eventbrite');
        }
      });

      for (const rawEvent of rawEvents) {
        try {
          const title = String(rawEvent?.name || '').trim();
          const startDateInfo = this.parseDateInfo(rawEvent?.startDate);
          const endDateInfo = this.extractEndDateInfo(rawEvent);
          const startDate = startDateInfo?.date ?? null;
          const endDate = this.resolveEndDate(startDate, endDateInfo?.date ?? null, endDateInfo?.hasTime ?? true);

          if (!title || !startDate || !endDate) continue;

          const address = this.extractAddress(rawEvent);
          const coordinates = this.extractCoordinates(rawEvent);
          if (!coordinates) continue;
          if (!this.isSevillaEvent(rawEvent, address)) continue;
          const { precio, precioMin, precioMax } = this.extractPrice(rawEvent);
          const image = Array.isArray(rawEvent?.image)
            ? rawEvent.image.find((img: unknown) => typeof img === 'string')
            : rawEvent?.image;

          const description = String(rawEvent?.description || '').trim();
          const categoriaHint = this.extractCategoryHint(rawEvent);
          const sourceUrl = this.asString(rawEvent?.url) ?? this.EVENTBRITE_SEVILLA_URL;
          const externalId = this.asString(rawEvent?.identifier) ?? this.asString(rawEvent?.url);

          events.push({
            title,
            description: description || `Evento en Sevilla: ${title}`,
            address,
            location: {
              type: 'Point',
              coordinates,
            },
            fechaInicio: startDate,
            fechaFin: endDate,
            precio,
            precioMin,
            precioMax,
            imagen: typeof image === 'string' ? image : undefined,
            sourceUrl,
            externalId,
            categoriaHint,
          });
        } catch (error) {
          this.logger.warn('Error parseando evento de Eventbrite');
        }
      }

      this.logger.log(`Eventbrite Sevilla: ${events.length} eventos parseados`);
    } catch (error) {
      this.logger.error('Error scrapeando Eventbrite Sevilla:', error);
    }
  }

  private extractEventsFromJsonLd(data: unknown): JsonRecord[] {
    const found: JsonRecord[] = [];
    const stack: unknown[] = [data];

    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;

      if (Array.isArray(current)) {
        stack.push(...current);
        continue;
      }

      if (typeof current !== 'object') continue;
      const obj = current as Record<string, unknown>;

      const type = obj['@type'];
      const isEvent =
        type === 'Event' || (Array.isArray(type) && type.some((entry) => entry === 'Event'));

      if (isEvent) {
        found.push(obj);
      }

      for (const value of Object.values(obj)) {
        if (value && typeof value === 'object') {
          stack.push(value);
        }
      }
    }

    return found;
  }

  private extractAddress(rawEvent: JsonRecord): string {
    const location = (rawEvent?.location && typeof rawEvent.location === 'object'
      ? (rawEvent.location as JsonRecord)
      : {}) as JsonRecord;
    const address = (location?.address && typeof location.address === 'object'
      ? (location.address as JsonRecord)
      : {}) as JsonRecord;
    const parts = [
      address?.streetAddress,
      address?.addressLocality,
      address?.postalCode,
      address?.addressRegion,
    ]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean);

    if (parts.length > 0) {
      return parts.join(', ');
    }

    const locationName = this.asString(location?.name);
    if (locationName) {
      return locationName;
    }

    return 'Sevilla';
  }

  private extractCoordinates(rawEvent: JsonRecord): [number, number] | null {
    const location = (rawEvent?.location && typeof rawEvent.location === 'object'
      ? (rawEvent.location as JsonRecord)
      : {}) as JsonRecord;
    const geo = (location?.geo && typeof location.geo === 'object'
      ? (location.geo as JsonRecord)
      : {}) as JsonRecord;
    const longitude = Number(geo?.longitude);
    const latitude = Number(geo?.latitude);

    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
      return [longitude, latitude];
    }

    return null;
  }

  private isSevillaEvent(rawEvent: JsonRecord, address: string): boolean {
    const attendanceMode = String(rawEvent?.eventAttendanceMode || '').toLowerCase();
    if (attendanceMode.includes('online')) return false;

    const location = (rawEvent?.location && typeof rawEvent.location === 'object'
      ? (rawEvent.location as JsonRecord)
      : {}) as JsonRecord;
    const locationAddress = (location?.address && typeof location.address === 'object'
      ? (location.address as JsonRecord)
      : {}) as JsonRecord;

    const locationType = String(location?.['@type'] || '').toLowerCase();
    if (locationType.includes('virtual')) return false;

    const text = [
      address,
      location?.name,
      locationAddress?.addressLocality,
      locationAddress?.addressRegion,
      locationAddress?.streetAddress,
    ]
      .filter((value) => typeof value === 'string')
      .join(' ')
      .toLowerCase();

    return text.includes('sevilla');
  }

  private extractPrice(rawEvent: JsonRecord): {
    precio: number | null;
    precioMin: number | null;
    precioMax: number | null;
  } {
    const offers = rawEvent?.offers;

    if (Array.isArray(offers) && offers.length) {
      const prices = offers
        .map((offer) => Number(offer?.price))
        .filter((price) => Number.isFinite(price) && price >= 0);

      if (prices.length === 1) {
        return { precio: prices[0], precioMin: null, precioMax: null };
      }

      if (prices.length > 1) {
        return {
          precio: null,
          precioMin: Math.min(...prices),
          precioMax: Math.max(...prices),
        };
      }
    }

    if (offers && !Array.isArray(offers)) {
      const offerRecord = offers as JsonRecord;
      const lowPrice = Number(offerRecord?.lowPrice);
      const highPrice = Number(offerRecord?.highPrice);
      const price = Number(offerRecord?.price);

      if (Number.isFinite(lowPrice) && Number.isFinite(highPrice) && lowPrice <= highPrice) {
        return { precio: null, precioMin: lowPrice, precioMax: highPrice };
      }

      if (Number.isFinite(price) && price >= 0) {
        return { precio: price, precioMin: null, precioMax: null };
      }
    }

    return { precio: null, precioMin: null, precioMax: null };
  }

  private extractCategoryHint(rawEvent: JsonRecord): string | undefined {
    const candidates: string[] = [];

    if (typeof rawEvent?.eventAttendanceMode === 'string') {
      candidates.push(rawEvent.eventAttendanceMode);
    }

    if (Array.isArray(rawEvent?.keywords)) {
      for (const keyword of rawEvent.keywords) {
        if (typeof keyword === 'string') candidates.push(keyword);
      }
    } else if (typeof rawEvent?.keywords === 'string') {
      candidates.push(...rawEvent.keywords.split(','));
    }

    const offers = rawEvent?.offers;
    if (Array.isArray(offers)) {
      for (const offer of offers) {
        if (typeof offer?.category === 'string') candidates.push(offer.category);
      }
    } else if (offers && typeof offers === 'object') {
      const offerRecord = offers as JsonRecord;
      if (typeof offerRecord?.category === 'string') {
        candidates.push(offerRecord.category);
      }
    }

    const normalized = candidates
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .join(' ')
      .toLowerCase();

    if (!normalized) return undefined;

    if (/(music|concert|festival|dj|live|flamenco)/.test(normalized)) return 'Conciertos';
    if (/(food|wine|drink|gastronom|tapas|dinner|brunch)/.test(normalized)) return 'Gastronomía';
    if (/(business|network|career|startup|tech|conference)/.test(normalized)) return 'Networking';
    if (/(workshop|course|class|seminar|training|masterclass)/.test(normalized)) return 'Talleres';
    if (/(sport|fitness|yoga|running|wellness)/.test(normalized)) return 'Deportes';
    if (/(art|culture|museum|theatre|theater|cinema|film|literature)/.test(normalized)) return 'Cultura';
    if (/(family|kids|children|infantil)/.test(normalized)) return 'Infantil';
    if (/(party|nightlife|leisure|tour|escape)/.test(normalized)) return 'Ocio';

    return undefined;
  }

  //Scraper de agenda municipal de Sevilla
  private async scrapeAgendaSevilla(events: ScrapedEvent[]): Promise<void> {
    try {
      const url = this.AGENDA_SEVILLA_URL;
      const countBefore = events.length;

      await this.scrapeAgendaSevillaRss(events);
      if (events.length > countBefore) {
        this.logger.log(`Agenda Sevilla (RSS): ${events.length - countBefore} eventos añadidos`);
        return;
      }

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const $ = cheerio.load(response.data);

      const jsonLdScripts = $('script[type="application/ld+json"]');
      let jsonLdEvents = 0;

      jsonLdScripts.each((_, element) => {
        const raw = $(element).html() || '';
        if (!raw) return;

        try {
          const parsed = JSON.parse(raw);
          const eventRecords = this.extractEventsFromJsonLd(parsed);

          for (const rawEvent of eventRecords) {
            const title = this.asString(rawEvent?.name);
            const start = this.parseDateInfo(rawEvent?.startDate)?.date ?? null;
            const endInfo = this.extractEndDateInfo(rawEvent);
            const end = this.resolveEndDate(start, endInfo?.date ?? null, endInfo?.hasTime ?? false);

            if (!title || !start || !end) continue;

            const address = this.extractAddress(rawEvent) || 'Sevilla';
            const coordinates = this.extractCoordinates(rawEvent) ?? [-5.9845, 37.3891];
            const description = this.asString(rawEvent?.description) ?? 'Sin descripción';

            const location = rawEvent?.location as JsonRecord | undefined;
            const image = Array.isArray(rawEvent?.image)
              ? rawEvent.image.find((img: unknown) => typeof img === 'string')
              : rawEvent?.image;
            const sourceUrl = this.asString(rawEvent?.url) ?? url;
            const externalId =
              this.asString(rawEvent?.identifier) ??
              this.asString((location as JsonRecord | undefined)?.url) ??
              sourceUrl;

            events.push({
              title,
              description,
              address,
              location: {
                type: 'Point',
                coordinates,
              },
              fechaInicio: start,
              fechaFin: end,
              precio: null,
              imagen: typeof image === 'string' ? this.normalizeUrl(image, url) : undefined,
              sourceUrl,
              externalId,
              categoriaHint: 'Cultura',
            });

            jsonLdEvents++;
          }
        } catch (err) {
          this.logger.warn(`Agenda Sevilla: bloque JSON-LD no parseable (${String(err)})`);
        }
      });

      if (jsonLdEvents === 0) {
        const selectors = [
          '.evento-item',
          '[itemtype*="Event"]',
          '.view-content .views-row',
          '.node--type-event',
          'article',
          '[class*="event"]',
          '[class*="evento"]',
        ];

        const seen = new Set<string>();

        for (const selector of selectors) {
          const candidates = $(selector);
          this.logger.log(`Agenda Sevilla: selector "${selector}" -> ${candidates.length} nodos`);

          if (!candidates.length) continue;

          candidates.each((_, element) => {
            try {
              const node = $(element);
              const title =
                node.find('h1, h2, h3, .titulo, .title, .field--name-title').first().text().trim() ||
                node.find('a[title]').first().attr('title')?.trim() ||
                node.find('a').first().text().trim();

              const dateFromAttr =
                node.find('time').first().attr('datetime') || node.find('[datetime]').first().attr('datetime');

              const dateText =
                dateFromAttr ||
                node.find('.fecha, .date, .field--name-field-fecha, .event-date').first().text().trim() ||
                node.find('time').first().text().trim();

              const parsedDate = this.parseDate(dateText);
              if (!title || !parsedDate) return;

              const dedupeKey = `${title.toLowerCase()}|${parsedDate.toISOString().slice(0, 10)}`;
              if (seen.has(dedupeKey)) return;
              seen.add(dedupeKey);

              const description =
                node.find('.descripcion, .summary, .field--name-body, .event-description, p').first().text().trim() ||
                'Sin descripción';

              const address =
                node.find('.lugar, .location, .field--name-field-lugar, .event-location').first().text().trim() ||
                'Sevilla';

              const img = node.find('img').first().attr('src');
              const href = node.find('a[href]').first().attr('href');
              const sourceUrl = href ? this.normalizeUrl(href, url) : url;

              const endDate = new Date(parsedDate);
              endDate.setHours(endDate.getHours() + 2);

              events.push({
                title,
                description,
                address,
                location: {
                  type: 'Point',
                  coordinates: [-5.9845, 37.3891],
                },
                fechaInicio: parsedDate,
                fechaFin: endDate,
                precio: null,
                imagen: img ? this.normalizeUrl(img, url) : undefined,
                sourceUrl,
                externalId: sourceUrl,
                categoriaHint: 'Cultura',
              });
            } catch (err) {
              this.logger.warn(`Agenda Sevilla: error parseando tarjeta de evento (${String(err)})`);
            }
          });

          if (events.length > countBefore) {
            break;
          }
        }
      }

      const added = events.length - countBefore;
      this.logger.log(`Agenda Sevilla: ${added} eventos añadidos`);
    } catch (error) {
      this.logger.error('Error scrapeando agenda de Sevilla:', error);
    }
  }

  private async scrapeAgendaSevillaRss(events: ScrapedEvent[]): Promise<void> {
    try {
      const response = await axios.get(this.AGENDA_SEVILLA_RSS_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data, { xmlMode: true });
      const items = $('item');
      this.logger.log(`Agenda Sevilla RSS: ${items.length} items`);
      const seen = new Set<string>();

      items.each((_, element) => {
        const node = $(element);
        const title = node.find('title').first().text().trim();
        const description = node.find('description').first().text().trim();
        const link = node.find('link').first().text().trim();
        const pubDate = node.find('pubDate').first().text().trim();

        if (!title) return;

        const dedupeKey = `${title.toLowerCase()}|${(link || '').toLowerCase()}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const parsedDate = this.parseDate(pubDate) ?? new Date();
        const endDate = new Date(parsedDate);
        endDate.setHours(endDate.getHours() + 2);

        events.push({
          title,
          description: description || 'Sin descripción',
          address: 'Sevilla',
          location: {
            type: 'Point',
            coordinates: [-5.9845, 37.3891],
          },
          fechaInicio: parsedDate,
          fechaFin: endDate,
          precio: null,
          sourceUrl: link || this.AGENDA_SEVILLA_URL,
          externalId: link || `${this.AGENDA_SEVILLA_RSS_URL}#${title}`,
          categoriaHint: 'Cultura',
        });
      });
    } catch (error) {
      this.logger.warn('Agenda Sevilla RSS no disponible, usando fallback HTML');
    }
  }

  //Scraper de salas de conciertos en Sevilla: TODO: implementacion extra
  private async scrapeSalasConciertos(_events: ScrapedEvent[]): Promise<void> {
    // Ejemplo: Sala Fanatic, Teatro Lope de Vega, etc.
    this.logger.warn('scraper de salas de conciertos no implementado aún');
  }

  private parseDate(dateValue?: unknown): Date | null {
    return this.parseDateInfo(dateValue)?.date ?? null;
  }

  private parseDateInfo(dateValue?: unknown): ParsedDateInfo | null {
    if (!dateValue) return null;

    if (dateValue instanceof Date) {
      if (!Number.isFinite(dateValue.getTime())) return null;
      return { date: dateValue, hasTime: true };
    }

    if (typeof dateValue === 'number') {
      const date = new Date(dateValue);
      if (!Number.isFinite(date.getTime())) return null;
      return { date, hasTime: true };
    }

    if (typeof dateValue === 'string') {
      const dateString = dateValue.trim();
      if (!dateString) return null;
      const date = new Date(dateString);
      if (!Number.isFinite(date.getTime())) {
        const parsedSpanishDate = this.parseSpanishDateString(dateString);
        if (!parsedSpanishDate) return null;
        return { date: parsedSpanishDate.date, hasTime: parsedSpanishDate.hasTime };
      }

      const hasTime = /T\d{2}:\d{2}/.test(dateString) || /\s\d{2}:\d{2}/.test(dateString);
      return { date, hasTime };
    }

    if (Array.isArray(dateValue)) {
      for (const value of dateValue) {
        const parsed = this.parseDateInfo(value);
        if (parsed) return parsed;
      }
      return null;
    }

    if (typeof dateValue === 'object') {
      const record = dateValue as JsonRecord;
      const candidates = [
        record.endDate,
        record.startDate,
        record.dateTime,
        record.value,
        record['@value'],
      ];

      for (const candidate of candidates) {
        const parsed = this.parseDateInfo(candidate);
        if (parsed) return parsed;
      }
    }

    return null;
  }

  private parseSpanishDateString(input: string): ParsedDateInfo | null {
    const value = input
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\sde\s/g, ' ')
      .trim();

    const withTimeMatch = value.match(/(\d{1,2})[:.](\d{2})/);
    const hasTime = !!withTimeMatch;
    const hour = withTimeMatch ? Number(withTimeMatch[1]) : 12;
    const minute = withTimeMatch ? Number(withTimeMatch[2]) : 0;

    const dmyMatch = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (dmyMatch) {
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      const rawYear = Number(dmyMatch[3]);
      const year = rawYear < 100 ? 2000 + rawYear : rawYear;
      const date = new Date(year, month - 1, day, hour, minute, 0, 0);
      if (Number.isFinite(date.getTime())) return { date, hasTime };
    }

    const months: Record<string, number> = {
      enero: 0,
      febrero: 1,
      marzo: 2,
      abril: 3,
      mayo: 4,
      junio: 5,
      julio: 6,
      agosto: 7,
      septiembre: 8,
      setiembre: 8,
      octubre: 9,
      noviembre: 10,
      diciembre: 11,
    };

    const longMatch = value.match(/(\d{1,2})\s+([a-záéíóú]+)\s+(\d{4})/);
    if (longMatch) {
      const day = Number(longMatch[1]);
      const monthText = longMatch[2]
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const year = Number(longMatch[3]);
      const monthIndex = months[monthText];

      if (monthIndex !== undefined) {
        const date = new Date(year, monthIndex, day, hour, minute, 0, 0);
        if (Number.isFinite(date.getTime())) return { date, hasTime };
      }
    }

    return null;
  }

  private asString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private extractEndDateInfo(rawEvent: JsonRecord): ParsedDateInfo | null {
    const directCandidates: unknown[] = [
      rawEvent?.endDate,
      rawEvent?.end_date,
      rawEvent?.doorTime,
      rawEvent?.performerIn,
    ];

    for (const candidate of directCandidates) {
      const parsed = this.parseDateInfo(candidate);
      if (parsed) return parsed;
    }

    if (Array.isArray(rawEvent?.subEvent)) {
      let latestEnd: ParsedDateInfo | null = null;
      for (const subEvent of rawEvent.subEvent) {
        const parsed = this.parseDateInfo((subEvent as JsonRecord)?.endDate);
        if (!parsed) continue;
        if (!latestEnd || parsed.date.getTime() > latestEnd.date.getTime()) {
          latestEnd = parsed;
        }
      }
      if (latestEnd) return latestEnd;
    }

    return null;
  }

  private resolveEndDate(startDate: Date | null, endDate: Date | null, endHasTime = true): Date | null {
    if (!startDate) return null;

    if (endDate && !endHasTime) {
      const normalizedDateOnlyEnd = new Date(endDate);
      normalizedDateOnlyEnd.setHours(23, 59, 59, 999);
      if (normalizedDateOnlyEnd.getTime() > startDate.getTime()) {
        return normalizedDateOnlyEnd;
      }
    }

    if (!endDate || endDate.getTime() <= startDate.getTime()) {
      const fallbackEndDate = new Date(startDate);
      fallbackEndDate.setHours(fallbackEndDate.getHours() + 2);
      return fallbackEndDate;
    }

    return endDate;
  }

  // Normaliza URLs relativas a absolutas
  private normalizeUrl(url: string, baseUrl: string): string {
    if (url.startsWith('http')) {
      return url;
    }
    const base = new URL(baseUrl);
    return new URL(url, base.origin).toString();
  }


}
