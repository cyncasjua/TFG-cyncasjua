import type { Event } from '../types/event';

const SCRAPER_EMAIL = 'scraper.bot@sevillaneando.local';
const SCRAPER_NAME = 'Sevillaneando Bot';

export function isScrapedEvent(event: Pick<Event, 'creador'>): boolean {
  return event.creador?.email === SCRAPER_EMAIL || event.creador?.nombre === SCRAPER_NAME;
}

export function formatEventPrice(
  event: Pick<Event, 'precio' | 'precioMin' | 'precioMax' | 'creador'>,
  currency = '€'
): string {
  if (event.precioMin != null && event.precioMax != null) {
    return `${event.precioMin} ${currency} - ${event.precioMax} ${currency}`;
  }

  if (event.precio === 0) {
    return isScrapedEvent(event) ? 'Consultar precio' : 'Gratis';
  }

  if (event.precio != null) {
    return `${event.precio} ${currency}`;
  }

  return isScrapedEvent(event) ? 'Consultar precio' : 'Precio variable';
}
