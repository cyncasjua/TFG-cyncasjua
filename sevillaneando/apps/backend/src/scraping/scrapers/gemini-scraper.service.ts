import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';
import { IScraper, ScrapedEvent } from '../interfaces/scraper.interface';

@Injectable()
export class GeminiScraperService implements IScraper {
  name = 'Scraper Multi-Web con IA (Gemini)';
  private readonly logger = new Logger(GeminiScraperService.name);

  private genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

  private readonly urlsToScrape = [
    // --- INSTITUCIONALES Y OFICIALES ---
    'https://www.juntadeandalucia.es/cultura/agendaculturaldeandalucia/sevilla', //añade 9
    'https://visitasevilla.es/ahora-en-sevilla/', //añade 100

    // --- GRANDES RECINTOS Y TEATROS ---
    'https://www.teatrodelamaestranza.es/es/programacion/', //añade 28
    'https://fundacioncajasol.com/category/exposiciones/', //añade 6

    // --- GUÍAS DE OCIO Y AGENDAS CULTURALES ---
    'https://www.escenaensevilla.es/', //añade 4
    'https://salirporsevilla.com/que-hacer-en-sevilla-mejores-planes/', //añade 5 (estos son los que se añaden sin foto)
    'https://www.andalunet.com/agenda-sevilla/', //añade 13 (estos tambien se añaden sin foto)
  ];

  async scrape(): Promise<ScrapedEvent[]> {
    this.logger.log(
      `Iniciando extracción masiva con Gemini en ${this.urlsToScrape.length} URLs...`
    );
    let todosLosEventos: ScrapedEvent[] = [];

    for (let i = 0; i < this.urlsToScrape.length; i++) {
      const url = this.urlsToScrape[i];
      this.logger.log(`[${i + 1}/${this.urlsToScrape.length}] Procesando: ${url}`);
      const t0 = Date.now();
      try {
        const eventosDeEstaWeb = await this.extraerEventosDeUrl(url);
        todosLosEventos = [...todosLosEventos, ...eventosDeEstaWeb];
        this.logger.log(
          `[${i + 1}/${this.urlsToScrape.length}] Extraídos ${eventosDeEstaWeb.length} eventos de ${url} en ${((Date.now() - t0) / 1000).toFixed(1)}s`
        );

        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (error) {
        this.logger.error(
          `[${i + 1}/${this.urlsToScrape.length}] Falló en ${url} tras ${((Date.now() - t0) / 1000).toFixed(1)}s: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    this.logger.log(
      `Proceso finalizado. Gemini extrajo un total de ${todosLosEventos.length} eventos.`
    );
    return todosLosEventos;
  }

  private async extraerEventosDeUrl(url: string): Promise<ScrapedEvent[]> {
    const lugaresFamosos: Record<string, string> = {
      'plaza de españa': 'Av. María Luisa, s/n, 41013 Sevilla, España',
      'teatro de la maestranza': 'Paseo de Cristóbal Colón, 22, 41001 Sevilla, España',
      'teatro lope de vega': 'Av. María Luisa, s/n, 41013 Sevilla, España',
      'auditorio rocio jurado': 'Camino de los Descubrimientos, s/n, 41092 Sevilla, España',
      'cartuja center': 'C. Leonardo da Vinci, 7, 41092 Sevilla, España',
      fibes: 'Av. Alcalde Luis Uruñuela, 1, 41020 Sevilla, España',
      'real alcázar': 'Patio de Banderas, s/n, 41004 Sevilla, España',
      'catedral de sevilla': 'Av. de la Constitución, s/n, 41004 Sevilla, España',
      'recinto ferial': 'Calle Antonio Bienvenida, 41011 Sevilla, España',
      'barrio de triana': 'Calle San Jacinto, 41010 Sevilla, España',
      'isla mágica': 'Pabellón de España, Isla de la Cartuja, 41092 Sevilla, España',
      'estadio ramón sánchez pizjuán': 'C. Sevilla Fútbol Club, s/n, 41005 Sevilla, España',
      'estadio benito villamarín': 'Av. de la Palmera, s/n, 41012 Sevilla, España',
    };
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 60000);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: fetchController.signal,
      });
    } finally {
      clearTimeout(fetchTimeout);
    }

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
    }

    const htmlRaw = await response.text();

    const $ = cheerio.load(htmlRaw);
    const imagenesPrincipales: string[] = [];
    $('img').each((_, img) => {
      const src = $(img).attr('src') || '';
      const alt = ($(img).attr('alt') || '').toLowerCase();
      if (
        src &&
        !/logo|icon|placeholder|blank|pixel|svg|data:image/.test(src) &&
        src.length > 10 &&
        (!alt || !/logo|icon|placeholder|pixel/.test(alt))
      ) {
        let urlFinal = src;
        if (!/^https?:\/\//.test(src)) {
          try {
            const base = new URL(url);
            urlFinal = new URL(src, base).href;
          } catch (err) {
            this.logger.debug(`No se pudo normalizar URL de imagen ${src}: ${String(err)}`);
            urlFinal = src;
          }
        }
        imagenesPrincipales.push(urlFinal);
      }
    });

    $('script, style, nav, footer, header, svg, iframe, noscript, button, meta, link').remove();

    const htmlLimpio = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 45000);

    if (!htmlLimpio) {
      throw new Error('El HTML se quedó vacío tras la limpieza.');
    }

    const prompt = `Eres un experto en extracción de datos web. Tu tarea es extraer todos los eventos (conciertos, teatro, exposiciones, mercadillos, fiestas, concursos, etc.) del siguiente texto extraído de una página web de Sevilla.

Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura exacta, sin bloques de código markdown:
{
  "eventos": [
    {
      "title": "Nombre del evento",
      "description": "Descripción del evento (máximo 3 frases)",
      "address": "Dirección postal completa del lugar de celebración (ej: Av. María Luisa, s/n, 41013 Sevilla, España para Plaza de España; Calle Temprado, 3, 41001 Sevilla, España para Teatro de la Maestranza). Si no puedes extraer la dirección postal completa, pon el nombre del lugar y 'Sevilla, España'. Si no lo pone, pon 'Sevilla, España'",
      "fechaInicio": "YYYY-MM-DDTHH:mm:ss",
      "fechaFin": "YYYY-MM-DDTHH:mm:ss",
      "precio": 0,
      "precioMin": null,
      "precioMax": null,
      "categoriaHint": "Una sola palabra clave (ej: Conciertos, Teatro, Infantil, Cultura, Gastronomía, Mercadillo, Fiestas, Concursos)",
      "imagen": "URL de la imagen principal del evento si está disponible, si no, null",
      "location": {"type": "Point", "coordinates": [longitud, latitud]}
    }
  ]
}

Reglas estrictas:
- Extrae la dirección postal completa del lugar de celebración siempre que sea posible (calle, número, código postal, ciudad, país). Si solo tienes el nombre del lugar, añade 'Sevilla, España'.
- Si el evento es explícitamente gratuito (se menciona "gratis", "entrada libre", "gratuito", "free", "sin cargo"), pon "precio": 0.
- Si el precio no se menciona o no está claro, pon "precio": null (no asumas que es gratis).
- Si hay un rango de precios, usa "precioMin" y "precioMax" y pon "precio": null. Si solo hay un precio concreto, usa "precio" y deja min/max a null.
- Extrae las fechas y conviértelas al formato ISO 8601. Si el año no se especifica explícitamente, asume el año actual. Si solo hay fecha pero no hora, usa "T00:00:00".
- Si el evento tiene una imagen o foto representativa en la página, pon la URL en "imagen". Si no hay imagen, pon null. Si hay varias imágenes, intenta asociar la más relevante según el título o la descripción del evento.
- Si puedes deducir la ubicación (coordenadas), ponlas en "location" como [longitud, latitud]. Si no, pon null.
- Solo incluye eventos que se celebren en Sevilla (ciudad). Descarta eventos de otras ciudades aunque aparezcan en la página.
- Si el texto no contiene ningún evento real en Sevilla, devuelve {"eventos": []}.

Imágenes principales encontradas en la página (puedes usarlas para asociar a los eventos si corresponde, intenta asociar la imagen más relevante a cada evento):
${imagenesPrincipales.length ? imagenesPrincipales.map((img, i) => `Imagen${i + 1}: ${img}`).join('\n') : 'Ninguna'}

Texto de la página:
${htmlLimpio}
`;

    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    this.logger.log(`Enviando prompt a Gemini para: ${url}`);
    const result = (await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini timeout (360s)')), 360000)
      ),
    ])) as Awaited<ReturnType<typeof model.generateContent>>;

    let textoRespuesta = result.response.text();
    textoRespuesta = textoRespuesta
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    try {
      const datosParseados = JSON.parse(textoRespuesta);

      const eventos: ScrapedEvent[] = [];
      for (const evento of datosParseados.eventos || []) {
        const fechaInicio = evento.fechaInicio ? new Date(evento.fechaInicio) : null;
        const fechaFin = evento.fechaFin ? new Date(evento.fechaFin) : null;

        const imagenFinal = evento.imagen || null;

        const descripcionFinal = `${evento.description || ''}\n\nFuente: ${url}`.trim();

        let addressFinal = evento.address || 'Sevilla, España';
        const addressKey = addressFinal.trim().toLowerCase();
        for (const nombreLugar in lugaresFamosos) {
          if (addressKey.includes(nombreLugar)) {
            addressFinal = lugaresFamosos[nombreLugar];
            break;
          }
        }

        let locationFinal = null;
        if (
          evento.location &&
          evento.location.coordinates &&
          evento.location.coordinates.length === 2
        ) {
          const [lon, lat] = evento.location.coordinates;
          if (!isNaN(lon) && !isNaN(lat)) {
            locationFinal = evento.location;
          }
        } else if (
          addressFinal &&
          addressFinal !== 'Sevilla' &&
          addressFinal !== 'Sevilla, España'
        ) {
          // Primer intento: dirección completa
          let geoData = null;
          try {
            const query = encodeURIComponent(addressFinal);
            const geoResp = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
              {
                headers: { 'User-Agent': 'sevillaneando-bot/1.0' },
              }
            );
            if (geoResp.ok) {
              geoData = await geoResp.json();
            }
          } catch (err) {
            this.logger.debug(
              `Geocodificación principal fallida para "${addressFinal}": ${String(err)}`
            );
          }

          if (!geoData || geoData.length === 0) {
            // Variante 1: solo nombre del lugar (si hay coma)
            const soloNombre = addressFinal.split(',')[0];
            if (soloNombre && soloNombre.trim().length > 3) {
              try {
                const query = encodeURIComponent(soloNombre + ', Sevilla, España');
                const geoResp = await fetch(
                  `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
                  {
                    headers: { 'User-Agent': 'sevillaneando-bot/1.0' },
                  }
                );
                if (geoResp.ok) {
                  geoData = await geoResp.json();
                }
              } catch (err) {
                this.logger.debug(
                  `Geocodificación por nombre fallida para "${soloNombre}": ${String(err)}`
                );
              }
            }
          }

          // Variante 2: quitar "España" si sigue sin funcionar
          if ((!geoData || geoData.length === 0) && addressFinal.includes('España')) {
            try {
              const query = encodeURIComponent(addressFinal.replace(', España', ''));
              const geoResp = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
                {
                  headers: { 'User-Agent': 'sevillaneando-bot/1.0' },
                }
              );
              if (geoResp.ok) {
                geoData = await geoResp.json();
              }
            } catch (err) {
              this.logger.debug(
                `Geocodificación sin país fallida para "${addressFinal}": ${String(err)}`
              );
            }
          }

          // Si alguna variante ha funcionado, asigna locationFinal
          if (geoData && geoData.length > 0) {
            const lon = parseFloat(geoData[0].lon);
            const lat = parseFloat(geoData[0].lat);
            if (!isNaN(lon) && !isNaN(lat)) {
              locationFinal = { type: 'Point', coordinates: [lon, lat] };
            }
          }
        }

        // Normalizar precios para cumplir la validación de la entidad Event.
        // Regla: usar rango solo si existe min y max con min < max. En cualquier
        // otro caso, degradar a precio fijo para evitar rechazos al persistir.
        const parsedPrecio = Number(evento.precio);
        const parsedPrecioMin = Number(evento.precioMin);
        const parsedPrecioMax = Number(evento.precioMax);

        let precio = Number.isFinite(parsedPrecio) ? parsedPrecio : null;
        let precioMin = Number.isFinite(parsedPrecioMin) ? parsedPrecioMin : null;
        let precioMax = Number.isFinite(parsedPrecioMax) ? parsedPrecioMax : null;

        if (precioMin != null && precioMax != null) {
          if (precioMin > precioMax) {
            [precioMin, precioMax] = [precioMax, precioMin];
          }
          if (precioMin === precioMax) {
            precio = precioMin;
            precioMin = null;
            precioMax = null;
          }
        } else if (precioMin != null || precioMax != null) {
          precio = precioMin ?? precioMax;
          precioMin = null;
          precioMax = null;
        }

        if (precio != null && precio < 0) {
          precio = null;
        }
        if (precioMin != null && precioMin < 0) {
          precioMin = null;
        }
        if (precioMax != null && precioMax < 0) {
          precioMax = null;
        }

        if (locationFinal) {
          eventos.push({
            title: evento.title || 'Evento sin título',
            description: descripcionFinal,
            address: addressFinal,
            fechaInicio: fechaInicio && !isNaN(fechaInicio.getTime()) ? fechaInicio : null,
            fechaFin: fechaFin && !isNaN(fechaFin.getTime()) ? fechaFin : null,
            precio,
            precioMin,
            precioMax,
            categoriaHint: evento.categoriaHint || 'Otros',
            imagen: imagenFinal,
            sourceUrl: url,
            location: locationFinal,
          });
        }
      }

      return eventos;
    } catch (parseError) {
      const mensajeError = parseError instanceof Error ? parseError.message : String(parseError);
      throw new Error(
        `Gemini devolvió un formato no válido: ${mensajeError}. Respuesta original: ${textoRespuesta.substring(0, 100)}...`
      );
    }
  }
}
