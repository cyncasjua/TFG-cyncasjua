import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { IScraper, ScrapedEvent } from '../interfaces/scraper.interface';

type JsonRecord = Record<string, unknown>;
type ParsedDateInfo = { date: Date; hasTime: boolean };
type EventbriteListingCard = {
  href: string;
  title: string;
  timeText?: string;
  locationText?: string;
};

@Injectable()
export class SevillaScraperService implements IScraper {
  readonly name = 'sevilla-events';
  private readonly logger = new Logger(SevillaScraperService.name);
  private readonly EVENTBRITE_SEVILLA_URL = 'https://www.eventbrite.es/d/spain--sevilla/events/';
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
      const listingCards = this.extractEventbriteListingCards($);
      const jsonLdScripts = $('script[type="application/ld+json"]');

      if (!jsonLdScripts.length) {
        this.logger.warn('No se encontraron scripts JSON-LD en Eventbrite');
        return;
      }

      const rawEvents: JsonRecord[] = [];
      const detailCache = new Map<string, JsonRecord | null>();

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
          const sourceUrl = this.asString(rawEvent?.url) ?? this.EVENTBRITE_SEVILLA_URL;
          let eventData = rawEvent;

          const listingStartDateInfo = this.parseDateInfo(eventData?.startDate);
          let startDateInfo = listingStartDateInfo;
          let endDateInfo = this.extractEndDateInfo(eventData);
          const listingCard = listingCards.get(this.normalizeUrlForComparison(sourceUrl));
          const listingCardDateInfo = this.parseEventbriteListingDateInfo(listingCard?.timeText);
          startDateInfo = this.pickBestDateInfo([listingCardDateInfo, startDateInfo]);
          const detailedEvent = sourceUrl.includes('/e/')
            ? await this.loadEventbriteEventDetailCached(sourceUrl, detailCache)
            : null;

          if (detailedEvent) {
            eventData = detailedEvent;
            const detailStartDateInfo = this.parseDateInfo(eventData?.startDate);
            startDateInfo =
              this.pickBestDateInfo([listingCardDateInfo, startDateInfo, detailStartDateInfo]) ??
              startDateInfo;
            if (!endDateInfo?.date) {
              endDateInfo = this.extractEndDateInfo(eventData) ?? endDateInfo;
            }
          }

          let hasMultipleDatesAvailable =
            this.hasMultipleEventbriteDates(rawEvent, listingCard?.timeText) ||
            Boolean((eventData as JsonRecord | undefined)?.hasMultipleDatesAvailable);

          const title = String(eventData?.name || rawEvent?.name || '').trim();
          const parsedStartDate = this.resolveEventbriteStartDate(
            startDateInfo,
            listingCard?.timeText
          );
          const hasExplicitStartTime = Boolean(startDateInfo?.hasTime);
          const hasParsedEndDate = Boolean(endDateInfo?.date);

          if (!hasMultipleDatesAvailable && !hasExplicitStartTime && !hasParsedEndDate) {
            hasMultipleDatesAvailable = true;
          }

          let startDate = hasMultipleDatesAvailable ? null : parsedStartDate;
          let endDate = hasMultipleDatesAvailable
            ? null
            : this.resolveEndDate(
                startDate,
                endDateInfo?.date ?? null,
                endDateInfo?.hasTime ?? true
              );

          if (
            !hasMultipleDatesAvailable &&
            startDate &&
            !endDate &&
            startDate.getHours() === 0 &&
            startDate.getMinutes() === 0 &&
            startDate.getSeconds() === 0
          ) {
            hasMultipleDatesAvailable = true;
            startDate = null;
            endDate = null;
          }

          if (!title) continue;

          const address = this.extractAddress(eventData);
          const coordinates =
            this.extractCoordinates(eventData) ?? this.extractCoordinates(rawEvent);
          if (!coordinates) continue;
          if (!this.isSevillaEvent(eventData, address)) continue;
          const { precio, precioMin, precioMax } = this.extractPrice(eventData);
          const image = Array.isArray(eventData?.image)
            ? eventData.image.find((img: unknown) => typeof img === 'string')
            : eventData?.image;

          const description = String(eventData?.description || rawEvent?.description || '').trim();
          const categoriaHint =
            this.extractCategoryHint(eventData) ?? this.extractCategoryHint(rawEvent);
          const externalId =
            this.asString(eventData?.identifier) ??
            this.asString(rawEvent?.identifier) ??
            this.asString(eventData?.url) ??
            this.asString(rawEvent?.url);

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
            hasMultipleDatesAvailable,
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

  private extractEventbriteListingCards($: cheerio.CheerioAPI): Map<string, EventbriteListingCard> {
    const cards = new Map<string, EventbriteListingCard>();

    $('a.event-card-link').each((_, element) => {
      const link = $(element);
      const href = link.attr('href');
      if (!href) return;

      const container = link.parent();
      const title =
        link.find('h3').first().text().trim() ||
        this.asString(link.attr('aria-label'))?.replace(/^Ver\s+/i, '') ||
        '';

      const detailsSection = container.children('section.event-card-details').first();
      const detailParagraphs = detailsSection.find('p');
      const timeText = detailParagraphs.eq(0).text().trim();
      const locationText = detailParagraphs.eq(1).text().trim();

      cards.set(this.normalizeUrlForComparison(href), {
        href,
        title,
        timeText: timeText || undefined,
        locationText: locationText || undefined,
      });
    });

    return cards;
  }

  private resolveEventbriteStartDate(
    startDateInfo: ParsedDateInfo | null,
    listingTimeText?: string
  ): Date | null {
    if (!startDateInfo?.date) return null;

    if (startDateInfo.hasTime) {
      return startDateInfo.date;
    }

    const parsedTime = this.parseEventbriteCardTime(listingTimeText);
    if (!parsedTime) {
      return startDateInfo.date;
    }

    const resolved = new Date(startDateInfo.date);
    resolved.setHours(parsedTime.hour, parsedTime.minute, 0, 0);
    return resolved;
  }

  private parseEventbriteListingDateInfo(listingTimeText?: string): ParsedDateInfo | null {
    if (!listingTimeText) return null;

    const text = listingTimeText.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();

    if (!text) return null;

    const parsed =
      this.parseEventbriteListingDatePattern(text, 'month-day') ??
      this.parseEventbriteListingDatePattern(text, 'day-month');

    if (!parsed) return null;

    const now = new Date();
    const currentYear = now.getFullYear();
    let resolvedDate = new Date(
      currentYear,
      parsed.monthIndex,
      parsed.day,
      parsed.hour,
      parsed.minute,
      0,
      0
    );

    if (resolvedDate.getTime() < now.getTime() - 1000 * 60 * 60 * 24 * 7) {
      resolvedDate = new Date(
        currentYear + 1,
        parsed.monthIndex,
        parsed.day,
        parsed.hour,
        parsed.minute,
        0,
        0
      );
    }

    if (!Number.isFinite(resolvedDate.getTime())) return null;

    return { date: resolvedDate, hasTime: true };
  }

  private parseEventbriteListingDatePattern(
    text: string,
    mode: 'month-day' | 'day-month'
  ): { monthIndex: number; day: number; hour: number; minute: number } | null {
    const normalized = text
      .replace(/\u2022/g, ',')
      .replace(/\bto\b.*$/i, '')
      .trim();

    const pattern =
      mode === 'month-day'
        ? /(?:^[^,]+,\s*)?([a-záéíóúñ.]+)\s+(\d{1,2})(?:,\s*|\s+)(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm)?/i
        : /(?:^[^,]+,\s*)?(\d{1,2})\s+([a-záéíóúñ.]+)(?:,\s*|\s+)(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm)?/i;

    const match = normalized.match(pattern);
    if (!match) return null;

    const monthText = mode === 'month-day' ? match[1] : match[2];
    const day = Number(mode === 'month-day' ? match[2] : match[1]);
    const hour = Number(match[3]);
    const minute = Number(match[4] ?? '0');
    const meridiem = this.normalizeMeridiem(match[5]);

    const monthIndex = this.resolveEventbriteMonthIndex(monthText);
    if (
      monthIndex === null ||
      !Number.isFinite(day) ||
      !Number.isFinite(hour) ||
      !Number.isFinite(minute)
    ) {
      return null;
    }

    let resolvedHour = hour;
    if (meridiem === 'pm' && resolvedHour < 12) resolvedHour += 12;
    if (meridiem === 'am' && resolvedHour === 12) resolvedHour = 0;

    if (resolvedHour > 23 || minute > 59) return null;

    return { monthIndex, day, hour: resolvedHour, minute };
  }

  private resolveEventbriteMonthIndex(value: string): number | null {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\./g, '')
      .toLowerCase();

    const months: Record<string, number> = {
      jan: 0,
      january: 0,
      ene: 0,
      enero: 0,
      feb: 1,
      february: 1,
      febrero: 1,
      mar: 2,
      march: 2,
      marzo: 2,
      apr: 3,
      april: 3,
      abr: 3,
      abril: 3,
      may: 4,
      mayo: 4,
      jun: 5,
      june: 5,
      junio: 5,
      jul: 6,
      july: 6,
      julio: 6,
      aug: 7,
      august: 7,
      ago: 7,
      agosto: 7,
      sep: 8,
      sept: 8,
      september: 8,
      septiembre: 8,
      setiembre: 8,
      oct: 9,
      october: 9,
      octubre: 9,
      nov: 10,
      november: 10,
      noviembre: 10,
      dec: 11,
      december: 11,
      diciembre: 11,
    };

    for (const [monthName, monthIndex] of Object.entries(months)) {
      if (normalized.startsWith(monthName)) {
        return monthIndex;
      }
    }

    return null;
  }

  private extractAddress(rawEvent: JsonRecord): string {
    const location = (
      rawEvent?.location && typeof rawEvent.location === 'object'
        ? (rawEvent.location as JsonRecord)
        : {}
    ) as JsonRecord;
    const address = (
      location?.address && typeof location.address === 'object'
        ? (location.address as JsonRecord)
        : {}
    ) as JsonRecord;
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
    const location = (
      rawEvent?.location && typeof rawEvent.location === 'object'
        ? (rawEvent.location as JsonRecord)
        : {}
    ) as JsonRecord;
    const geo = (
      location?.geo && typeof location.geo === 'object' ? (location.geo as JsonRecord) : {}
    ) as JsonRecord;
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

    const location = (
      rawEvent?.location && typeof rawEvent.location === 'object'
        ? (rawEvent.location as JsonRecord)
        : {}
    ) as JsonRecord;
    const locationAddress = (
      location?.address && typeof location.address === 'object'
        ? (location.address as JsonRecord)
        : {}
    ) as JsonRecord;

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
    if (/(art|culture|museum|theatre|theater|cinema|film|literature)/.test(normalized))
      return 'Cultura';
    if (/(family|kids|children|infantil)/.test(normalized)) return 'Infantil';
    if (/(party|nightlife|leisure|tour|escape)/.test(normalized)) return 'Ocio';

    return undefined;
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

      const isoDateOnlyMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (isoDateOnlyMatch) {
        const year = Number(isoDateOnlyMatch[1]);
        const month = Number(isoDateOnlyMatch[2]);
        const day = Number(isoDateOnlyMatch[3]);
        const date = new Date(year, month - 1, day, 0, 0, 0, 0);
        if (Number.isFinite(date.getTime())) {
          return { date, hasTime: false };
        }
      }

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
      return this.pickBestDateInfo(dateValue);
    }

    if (typeof dateValue === 'object') {
      const record = dateValue as JsonRecord;

      if (Array.isArray(record.subEvent)) {
        const subEventStartDates = record.subEvent
          .map((subEvent) => this.parseDateInfo((subEvent as JsonRecord)?.startDate))
          .filter((value): value is ParsedDateInfo => value !== null);

        const bestSubEventDate = this.pickBestDateInfo(subEventStartDates);
        if (bestSubEventDate) return bestSubEventDate;
      }

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

  private pickBestDateInfo(values: Array<ParsedDateInfo | unknown>): ParsedDateInfo | null {
    const parsedDates = values
      .map((value) =>
        value && typeof value === 'object' && 'date' in value
          ? (value as ParsedDateInfo)
          : this.parseDateInfo(value)
      )
      .filter(
        (value): value is ParsedDateInfo => value !== null && Number.isFinite(value.date.getTime())
      );

    if (!parsedDates.length) return null;

    const now = Date.now();
    const futureDates = parsedDates
      .filter((value) => value.date.getTime() >= now)
      .sort((left, right) => left.date.getTime() - right.date.getTime());

    if (futureDates.length > 0) {
      return futureDates[0];
    }

    return parsedDates.sort((left, right) => right.date.getTime() - left.date.getTime())[0] ?? null;
  }

  private hasMultipleEventbriteDates(rawEvent: JsonRecord, listingTimeText?: string): boolean {
    if (Array.isArray(rawEvent?.startDate) && rawEvent.startDate.length > 1) {
      return true;
    }

    if (Array.isArray(rawEvent?.subEvent) && rawEvent.subEvent.length > 1) {
      return true;
    }

    if (typeof listingTimeText === 'string' && /\+\s*\d+\s*(m[aá]s|more)/i.test(listingTimeText)) {
      return true;
    }

    const eventSchedule = rawEvent?.eventSchedule;
    if (eventSchedule && typeof eventSchedule === 'object') {
      const scheduleRecord = eventSchedule as JsonRecord;
      if (Array.isArray(scheduleRecord?.subEvent) && scheduleRecord.subEvent.length > 1) {
        return true;
      }
    }

    return false;
  }

  private parseEventbriteCardTime(value?: string): { hour: number; minute: number } | null {
    if (!value) return null;

    const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
    const timeMatch = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm)?/i);

    if (!timeMatch) return null;

    let hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] ?? '0');
    const meridiem = this.normalizeMeridiem(timeMatch[3]);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;

    if (hour > 23 || minute > 59) return null;

    return { hour, minute };
  }

  private parseSpanishDateString(input: string): ParsedDateInfo | null {
    const value = input
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\sde\s/g, ' ')
      .trim();

    const withTimeMatch = value.match(/(\d{1,2})[:.](\d{2})/);
    const hasTime = !!withTimeMatch;
    const hour = withTimeMatch ? Number(withTimeMatch[1]) : 0;
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
      const monthText = longMatch[2].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const year = Number(longMatch[3]);
      const monthIndex = months[monthText];

      if (monthIndex !== undefined) {
        const date = new Date(year, monthIndex, day, hour, minute, 0, 0);
        if (Number.isFinite(date.getTime())) return { date, hasTime };
      }
    }

    return null;
  }

  private normalizeMeridiem(value?: string): 'am' | 'pm' | undefined {
    if (!value) return undefined;
    const normalized = value.toLowerCase().replace(/\./g, '');
    if (normalized === 'am') return 'am';
    if (normalized === 'pm') return 'pm';
    return undefined;
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

  private resolveEndDate(
    startDate: Date | null,
    endDate: Date | null,
    endHasTime = true
  ): Date | null {
    // Si no hay fecha de inicio, no hay fecha de fin
    if (!startDate) return null;

    // Si no hay fecha de fin especificada, devolver null (evento sin fecha definida)
    if (!endDate) return null;

    if (endDate && !endHasTime) {
      const sameCalendarDay =
        startDate.getFullYear() === endDate.getFullYear() &&
        startDate.getMonth() === endDate.getMonth() &&
        startDate.getDate() === endDate.getDate();

      if (sameCalendarDay) {
        return null;
      }

      const normalizedDateOnlyEnd = new Date(endDate);
      normalizedDateOnlyEnd.setHours(23, 59, 59, 999);
      if (normalizedDateOnlyEnd.getTime() > startDate.getTime()) {
        return normalizedDateOnlyEnd;
      }
    }

    if (endDate.getTime() <= startDate.getTime()) {
      return null;
    }

    return endDate;
  }

  private normalizeUrl(url: string, baseUrl: string): string {
    if (url.startsWith('http')) {
      return url;
    }
    const base = new URL(baseUrl);
    return new URL(url, base.origin).toString();
  }

  private async loadEventbriteEventDetailCached(
    url: string,
    cache: Map<string, JsonRecord | null>
  ): Promise<JsonRecord | null> {
    const normalizedUrl = this.normalizeUrlForComparison(url);
    if (cache.has(normalizedUrl)) {
      return cache.get(normalizedUrl) ?? null;
    }

    const detail = await this.loadEventbriteEventDetail(url);
    cache.set(normalizedUrl, detail);
    return detail;
  }

  private async loadEventbriteEventDetail(url: string): Promise<JsonRecord | null> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const scripts = $('script[type="application/ld+json"]');
      const pageText = $('body').text();

      for (const element of scripts.toArray()) {
        const raw = $(element).html() || '';
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw);
          const eventRecords = this.extractEventsFromJsonLd(parsed);

          for (const eventRecord of eventRecords) {
            const eventUrl = this.asString(eventRecord?.url);
            if (eventUrl && this.areUrlsEquivalent(eventUrl, url)) {
              return this.enrichEventbriteEventRecord(eventRecord, pageText);
            }
          }

          if (eventRecords.length > 0) {
            return this.enrichEventbriteEventRecord(eventRecords[0], pageText);
          }
        } catch (error) {
          this.logger.warn('No se pudo parsear un bloque JSON-LD de detalle de Eventbrite');
        }
      }
    } catch (error) {
      this.logger.warn(`No se pudo cargar el detalle de Eventbrite: ${String(error)}`);
    }

    return null;
  }

  private areUrlsEquivalent(left: string, right: string): boolean {
    return this.normalizeUrlForComparison(left) === this.normalizeUrlForComparison(right);
  }

  private normalizeUrlForComparison(url: string): string {
    return url.split('#')[0].split('?')[0].replace(/\/+$/, '');
  }

  private enrichEventbriteEventRecord(eventRecord: JsonRecord, pageText: string): JsonRecord {
    const startInfo = this.parseDateInfo(eventRecord?.startDate);
    const hasEndDate = this.extractEndDateInfo(eventRecord)?.date;
    const hasMultipleDatesAvailable = this.hasMultipleDatesInDetailPage(pageText, eventRecord);

    if (hasEndDate || !startInfo?.date) {
      return {
        ...eventRecord,
        hasMultipleDatesAvailable,
      };
    }

    if (startInfo.hasTime) {
      const inferredDurationEnd = this.inferEventbriteEndDateFromDurationText(
        pageText,
        startInfo.date
      );
      if (inferredDurationEnd) {
        return {
          ...eventRecord,
          endDate: inferredDurationEnd.date.toISOString(),
          hasMultipleDatesAvailable,
        };
      }
    }

    const inferredEndDate = this.inferEventbriteEndDateFromText(pageText, startInfo.date);
    if (!inferredEndDate) {
      return {
        ...eventRecord,
        hasMultipleDatesAvailable,
      };
    }

    return {
      ...eventRecord,
      endDate: inferredEndDate.date.toISOString(),
      hasMultipleDatesAvailable,
    };
  }

  private hasMultipleDatesInDetailPage(pageText: string, eventRecord: JsonRecord): boolean {
    if (/multiple dates|varias fechas/i.test(pageText)) {
      return true;
    }

    if (Array.isArray(eventRecord?.subEvent) && eventRecord.subEvent.length > 1) {
      return true;
    }

    const eventSchedule = eventRecord?.eventSchedule;
    if (eventSchedule && typeof eventSchedule === 'object') {
      const scheduleRecord = eventSchedule as JsonRecord;
      if (Array.isArray(scheduleRecord?.subEvent) && scheduleRecord.subEvent.length > 1) {
        return true;
      }
    }

    if (Array.isArray(eventRecord?.startDate) && eventRecord.startDate.length > 1) {
      return true;
    }

    return false;
  }

  private inferEventbriteEndDateFromDurationText(
    pageText: string,
    startDate: Date
  ): ParsedDateInfo | null {
    const normalizedText = pageText.replace(/\s+/g, ' ').toLowerCase();
    const compactText = normalizedText
      .replace(/\babout\b|\baprox(?:\.|imadamente)?\b|\baround\b/g, ' ')
      .trim();

    const hourMatch = compactText.match(/(\d{1,2})\s*(?:h|hr|hrs|hour|hours|hora|horas)\b/);
    const minuteMatch = compactText.match(
      /(\d{1,3})\s*(?:min|mins|minute|minutes|minuto|minutos)\b/
    );

    if (!hourMatch && !minuteMatch) return null;

    const durationHours = hourMatch ? Number(hourMatch[1]) : 0;
    const durationMinutes = minuteMatch ? Number(minuteMatch[1]) : 0;

    if (!Number.isFinite(durationHours) || !Number.isFinite(durationMinutes)) return null;
    if (durationHours === 0 && durationMinutes === 0) return null;

    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + durationHours * 60 + durationMinutes);

    if (!Number.isFinite(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
      return null;
    }

    return { date: endDate, hasTime: true };
  }

  private inferEventbriteEndDateFromText(pageText: string, startDate: Date): ParsedDateInfo | null {
    const normalizedText = pageText.replace(/\s+/g, ' ').toLowerCase();
    const match = normalizedText.match(
      /(?:from|de)?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm)?\s*(?:to|hasta|a|[-–—])\s*(\d{1,2})(?::(\d{2}))?\s*(a\.m\.|p\.m\.|am|pm)?/i
    );

    if (!match) return null;

    const endHourRaw = Number(match[4]);
    const endMinute = Number(match[5] ?? '0');
    const endMeridiem = this.normalizeMeridiem(match[6]) ?? this.normalizeMeridiem(match[3]);
    const endHour = this.to24Hour(endHourRaw, endMeridiem);

    if (!Number.isFinite(endHour) || !Number.isFinite(endMinute)) return null;

    const endDate = new Date(startDate);
    endDate.setHours(endHour, endMinute, 0, 0);

    if (!Number.isFinite(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
      return null;
    }

    return { date: endDate, hasTime: true };
  }

  private to24Hour(hour: number, meridiem?: 'am' | 'pm'): number {
    if (!Number.isFinite(hour)) return NaN;

    const normalizedHour = hour % 12;
    if (meridiem === 'pm') return normalizedHour + 12;
    if (meridiem === 'am') return normalizedHour;
    return hour;
  }
}
