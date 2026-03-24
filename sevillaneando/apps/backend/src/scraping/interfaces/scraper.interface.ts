import { GeoJsonPoint } from '../../common/geojson-point';

export interface ScrapedEvent {
  title: string;
  description: string;
  address: string;
  location: GeoJsonPoint;
  fechaInicio: Date;
  fechaFin: Date;
  precio?: number | null;
  precioMin?: number | null;
  precioMax?: number | null;
  categoriaId?: string;
  categoriaHint?: string;
  imagen?: string;
  imagenes?: string[];
  sourceUrl?: string; // URL de donde se extrajo
  externalId?: string; // ID del evento en la fuente externa
}

export interface IScraper {
  name: string;
  scrape(): Promise<ScrapedEvent[]>;
}
