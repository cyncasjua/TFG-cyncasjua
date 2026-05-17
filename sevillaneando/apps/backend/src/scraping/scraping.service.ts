import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../events/event.entity';
import { Categoria } from '../categorias/categoria.entity';
import { User } from '../users/user.entity';
import { Resena } from '../events/resena.entity';
import { Mensaje } from '../chat/mensaje.entity';
import { IScraper, ScrapedEvent } from './interfaces/scraper.interface';
import { EstadoEnum } from '../events/enums/estado.enum';
import { SevillaScraperService } from './scrapers/sevilla-scraper.service';
import { TicketmasterScraperService } from './scrapers/ticketmaster-scraper.service';
import { GeminiScraperService } from './scrapers/gemini-scraper.service';
import { VisitaSevillaScraperService } from './scrapers/visitasevilla-scraper.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

// Dominios que bloquean hotlinking — sus imágenes deben re-hospedarse en Cloudinary.
const BLOCKED_IMAGE_HOSTS = ['tic.visitasevilla.es'];

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);
  private readonly categoriaCache = new Map<string, Categoria>();
  private readonly scraperSystemUid = process.env.SCRAPER_SYSTEM_UID || 'system-scraper-uid';
  private readonly scraperSystemEmail =
    process.env.SCRAPER_SYSTEM_EMAIL || 'scraper.bot@sevillaneando.local';
  private readonly scraperSystemName = process.env.SCRAPER_SYSTEM_NAME || 'Sevillaneando Bot';
  private readonly legacyScraperEmail = process.env.LEGACY_SCRAPER_EMAIL || 'mod@demo.com';

  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Resena)
    private readonly resenaRepo: Repository<Resena>,
    @InjectRepository(Mensaje)
    private readonly mensajeRepo: Repository<Mensaje>,
    private readonly moduleRef: ModuleRef,
    private readonly cloudinaryService: CloudinaryService
  ) {}

  async scrapeAll(): Promise<{ total: number; saved: number; errors: number }> {
    let totalScraped = 0;
    let totalSaved = 0;
    let totalErrors = 0;
    const scrapers = this.getConfiguredScrapers();

    for (const scraper of scrapers) {
      try {
        this.logger.log(`Ejecutando scraper: ${scraper.name}`);
        const events = await scraper.scrape();
        totalScraped += events.length;

        const saved = await this.saveScrapedEvents(events);
        totalSaved += saved;

        this.logger.log(
          `${scraper.name}: ${events.length} eventos encontrados, ${saved} guardados`
        );
      } catch (error) {
        totalErrors++;
        this.logger.error(`Error en scraper ${scraper.name}:`, error);
      }
    }

    await this.backfillUncategorizedScrapedEvents();

    return { total: totalScraped, saved: totalSaved, errors: totalErrors };
  }

  async scrapeByName(scraperName: string): Promise<{ total: number; saved: number }> {
    const scraper = this.getConfiguredScrapers().find((s) => s.name === scraperName);
    if (!scraper) {
      throw new Error(`Scraper "${scraperName}" no encontrado`);
    }

    this.logger.log(`Ejecutando scraper: ${scraper.name}`);
    const events = await scraper.scrape();
    const saved = await this.saveScrapedEvents(events);
    await this.backfillUncategorizedScrapedEvents();

    return { total: events.length, saved };
  }

  private async saveScrapedEvents(scrapedEvents: ScrapedEvent[]): Promise<number> {
    let savedCount = 0;
    const seenInBatch = new Set<string>();

    let systemUser = await this.userRepo.findOne({ where: { firebaseUid: this.scraperSystemUid } });

    if (!systemUser) {
      systemUser = this.userRepo.create({
        nombre: this.scraperSystemName,
        email: this.scraperSystemEmail,
        firebaseUid: this.scraperSystemUid,
      });
      systemUser = await this.userRepo.save(systemUser);
      this.logger.log(`Usuario técnico de scraping creado: ${systemUser.email}`);
    }

    let nullLocationCount = 0;
    for (const scrapedEvent of scrapedEvents) {
      if (!scrapedEvent.location) {
        nullLocationCount++;
        this.logger.debug(`Evento descartado por location null: ${scrapedEvent.title}`);
        continue;
      }

      const normalizedDateEvent = this.normalizeLongEventDates(scrapedEvent);
      const normalizedEvent = this.normalizeMediaFields(
        this.normalizePriceFields(normalizedDateEvent)
      );

      normalizedEvent.imagen = await this.reHostImageIfNeeded(normalizedEvent.imagen);

      try {
        const batchKey = this.getDuplicateKey(normalizedEvent.title);
        if (seenInBatch.has(batchKey)) {
          this.logger.debug(`Evento duplicado en lote, omitido: ${normalizedEvent.title}`);
          continue;
        }

        const existingEvent = await this.eventRepo
          .createQueryBuilder('event')
          .leftJoinAndSelect('event.creador', 'creador')
          .where('LOWER(TRIM(event.title)) = LOWER(TRIM(:title))', {
            title: normalizedEvent.title,
          })
          .getOne();

        if (existingEvent) {
          this.logger.debug(`Evento ya existente, omitido: ${normalizedEvent.title}`);
          seenInBatch.add(batchKey);
          continue;
        }

        const categoria = await this.resolveCategory(normalizedEvent);
        const event = this.eventRepo.create({
          title: normalizedEvent.title,
          description: normalizedEvent.description,
          address: normalizedEvent.address,
          location: normalizedEvent.location,
          fechaInicio: normalizedEvent.fechaInicio,
          fechaFin: normalizedEvent.fechaFin,
          hasMultipleDatesAvailable: normalizedEvent.hasMultipleDatesAvailable ?? false,
          precio: normalizedEvent.precio ?? null,
          precioMin: normalizedEvent.precioMin ?? null,
          precioMax: normalizedEvent.precioMax ?? null,
          imagen: normalizedEvent.imagen,
          imagenes: normalizedEvent.imagenes,
          estado: EstadoEnum.Aprobado,
          creador: systemUser,
          privado: false,
          categoria,
        });

        await this.eventRepo.save(event);
        seenInBatch.add(batchKey);
        savedCount++;
        this.logger.debug(`Evento guardado: ${normalizedEvent.title}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Error guardando evento "${normalizedEvent.title}" (precio=${normalizedEvent.precio}, min=${normalizedEvent.precioMin}, max=${normalizedEvent.precioMax}): ${msg}`
        );
      }
    }
    if (nullLocationCount > 0) {
      this.logger.log(`Eventos descartados por location null: ${nullLocationCount}`);
    }

    return savedCount;
  }

  private isBlockedImageHost(url: string | undefined): boolean {
    if (!url) return false;
    try {
      const { hostname } = new URL(url);
      return BLOCKED_IMAGE_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
    } catch {
      return false;
    }
  }

  private async reHostImageIfNeeded(imageUrl: string | undefined): Promise<string | undefined> {
    if (!imageUrl || !this.isBlockedImageHost(imageUrl)) return imageUrl;

    try {
      const resp = await fetch(imageUrl, {
        headers: {
          Referer: 'https://visitasevilla.es/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        this.logger.warn(`reHostImage: HTTP ${resp.status} para ${imageUrl}`);
        return undefined;
      }

      const buffer = Buffer.from(await resp.arrayBuffer());
      const result = await this.cloudinaryService.uploadImage(buffer, {
        folder: 'sevillaneando/scraped',
        publicIdPrefix: 'visitasevilla',
      });

      this.logger.debug(`reHostImage: imagen subida a Cloudinary: ${result.optimizedUrl}`);
      return result.optimizedUrl;
    } catch (err) {
      this.logger.warn(`reHostImage: error rehospedando ${imageUrl}: ${String(err)}`);
      return undefined;
    }
  }

  getAvailableScrapers(): string[] {
    return this.getConfiguredScrapers().map((s) => s.name);
  }

  async resetScrapedEvents(): Promise<{ deleted: number; saved: number; errors: number }> {
    try {
      this.logger.log('resetScrapedEvents: buscando usuarios scraper...');
      const systemUser = await this.userRepo.findOne({
        where: { firebaseUid: this.scraperSystemUid },
      });
      const legacyUser = await this.userRepo.findOne({ where: { email: this.legacyScraperEmail } });

      this.logger.log(
        `resetScrapedEvents: systemUser=${systemUser?.id ?? 'no encontrado'}, legacyUser=${legacyUser?.id ?? 'no encontrado'}`
      );

      const scraperUsers: User[] = [];
      if (systemUser) scraperUsers.push(systemUser);
      if (legacyUser) scraperUsers.push(legacyUser);

      let deleted = 0;
      if (scraperUsers.length > 0) {
        const scraperIds = scraperUsers.map((u) => u.id);
        this.logger.log(`resetScrapedEvents: eliminando eventos de IDs: ${scraperIds.join(', ')}`);

        const scraperEvents = await this.eventRepo
          .createQueryBuilder('event')
          .select('event.id')
          .where('"creadorId" IN (:...ids)', { ids: scraperIds })
          .getMany();

        if (scraperEvents.length > 0) {
          const eventIds = scraperEvents.map((e) => e.id);
          await this.resenaRepo
            .createQueryBuilder()
            .delete()
            .from(Resena)
            .where('"eventoId" IN (:...ids)', { ids: eventIds })
            .execute();
          await this.mensajeRepo
            .createQueryBuilder()
            .delete()
            .from(Mensaje)
            .where('"eventoId" IN (:...ids)', { ids: eventIds })
            .execute();
        }

        const { affected } = await this.eventRepo
          .createQueryBuilder()
          .delete()
          .from(Event)
          .where('"creadorId" IN (:...ids)', { ids: scraperIds })
          .execute();
        deleted = affected ?? 0;
      } else {
        this.logger.warn(
          'resetScrapedEvents: no se encontró ningún usuario scraper, no se elimina nada'
        );
      }

      this.logger.log(`resetScrapedEvents: ${deleted} eventos eliminados. Iniciando scraping...`);
      const result = await this.scrapeAll();
      this.logger.log(
        `resetScrapedEvents: completado. saved=${result.saved}, errors=${result.errors}`
      );
      return { deleted, saved: result.saved, errors: result.errors };
    } catch (error) {
      this.logger.error('resetScrapedEvents: error inesperado:', error);
      throw error;
    }
  }

  private getConfiguredScrapers(): IScraper[] {
    const scrapers: IScraper[] = [];

    const sevillaScraperService = this.moduleRef.get(SevillaScraperService, { strict: false });
    const ticketmasterScraperService = this.moduleRef.get(TicketmasterScraperService, {
      strict: false,
    });
    const geminiScraperService = this.moduleRef.get(GeminiScraperService, { strict: false });
    const visitaSevillaScraperService = this.moduleRef.get(VisitaSevillaScraperService, {
      strict: false,
    });

    if (sevillaScraperService) {
      scrapers.push(sevillaScraperService);
    } else {
      this.logger.warn('SevillaScraperService no está disponible');
    }

    if (ticketmasterScraperService) {
      scrapers.push(ticketmasterScraperService);
    } else {
      this.logger.warn('TicketmasterScraperService no está disponible');
    }

    if (visitaSevillaScraperService) {
      scrapers.push(visitaSevillaScraperService);
    } else {
      this.logger.warn('VisitaSevillaScraperService no está disponible');
    }

    if (geminiScraperService) {
      scrapers.push(geminiScraperService);
    } else {
      this.logger.warn('GeminiScraperService no está disponible');
    }

    this.logger.log(`Scrapers activos: ${scrapers.map((s) => s.name).join(', ') || 'ninguno'}`);
    return scrapers;
  }

  private getDuplicateKey(title: string): string {
    const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, ' ');
    return normalizedTitle;
  }

  private normalizeLongEventDates(event: ScrapedEvent): ScrapedEvent {
    const isEventbriteSource =
      typeof event.sourceUrl === 'string' && /eventbrite\./i.test(event.sourceUrl);

    if (isEventbriteSource && event.fechaInicio && !event.fechaFin) {
      const start = new Date(event.fechaInicio);
      if (
        Number.isFinite(start.getTime()) &&
        start.getHours() === 0 &&
        start.getMinutes() === 0 &&
        start.getSeconds() === 0
      ) {
        return {
          ...event,
          fechaInicio: null,
          fechaFin: null,
          hasMultipleDatesAvailable: true,
        };
      }
    }

    if (!event.fechaInicio || !event.fechaFin) {
      return event;
    }

    const start = new Date(event.fechaInicio);
    const end = new Date(event.fechaFin);

    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return event;
    }

    if (end.getTime() <= start.getTime()) {
      return { ...event, fechaFin: null };
    }

    // Si el evento dura más de 7 días es casi seguro que Gemini extrajo un rango
    // de festival/ciclo en lugar de la fecha de una sesión concreta. En ese caso
    // quitamos las fechas y lo marcamos como "consultar fechas".
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) {
      this.logger.debug(
        `Evento con duración > 7 días (${diffDays.toFixed(1)} d) descartado como rango de festival: ${event.title}`
      );
      return {
        ...event,
        fechaInicio: null,
        fechaFin: null,
        hasMultipleDatesAvailable: true,
      };
    }

    // Obtener la fecha sin hora para ambas
    const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    // Si son del mismo día
    if (startDate.getTime() === endDate.getTime()) {
      const startHour = start.getHours();
      const startMinutes = start.getMinutes();
      const endHour = end.getHours();
      const endMinutes = end.getMinutes();

      // Si empieza a las 2:00 o antes y termina a las 23:00 o después
      // (considera como evento que cubre casi todo el día)
      const startsEarly = startHour <= 2 || (startHour === 2 && startMinutes === 0);
      const endsLate = endHour >= 23 || (endHour === 23 && endMinutes >= 0);

      if (startsEarly && endsLate) {
        this.logger.debug(
          `Evento detectado como de duración indefinida (cubre casi todo el día): ${event.title} ` +
            `(${start.toLocaleString()} - ${end.toLocaleString()}). Marcando como indefinido.`
        );
        return {
          ...event,
          fechaInicio: null,
          fechaFin: null,
        };
      }
    }

    return event;
  }

  private normalizePriceFields(event: ScrapedEvent): ScrapedEvent {
    let precio = this.toNonNegativeNumberOrNull(event.precio);
    let precioMin = this.toNonNegativeNumberOrNull(event.precioMin);
    let precioMax = this.toNonNegativeNumberOrNull(event.precioMax);

    const inferredRange = this.extractPriceRangeFromTextStable(
      `${event.title} ${event.description}`
    );
    if (
      inferredRange &&
      precioMin == null &&
      precioMax == null &&
      (precio == null || precio === inferredRange.precioMin || precio === inferredRange.precioMax)
    ) {
      precio = null;
      precioMin = inferredRange.precioMin;
      precioMax = inferredRange.precioMax;
    }

    if (precioMin != null && precioMax != null) {
      if (precioMin > precioMax) {
        [precioMin, precioMax] = [precioMax, precioMin];
      }

      // Si hay rango válido, se prioriza sobre precio fijo para cumplir la entidad.
      if (precioMin < precioMax) {
        precio = null;
      } else {
        // min == max, se degrada a precio fijo
        precio = precioMin;
        precioMin = null;
        precioMax = null;
      }
    } else if (precioMin != null || precioMax != null) {
      // Rango incompleto: se degrada a precio fijo
      precio = precioMin ?? precioMax;
      precioMin = null;
      precioMax = null;
    }

    return {
      ...event,
      precio,
      precioMin,
      precioMax,
    };
  }

  private normalizeMediaFields(event: ScrapedEvent): ScrapedEvent {
    const imagen = this.normalizeScrapedImageUrl(event.imagen);
    const imagenes = event.imagenes
      ?.map((image) => this.normalizeScrapedImageUrl(image))
      .filter((image): image is string => Boolean(image));

    return {
      ...event,
      imagen,
      imagenes: imagenes && imagenes.length > 0 ? imagenes : event.imagenes,
    };
  }

  private normalizeScrapedImageUrl(image?: string | null): string | undefined {
    if (!image) return undefined;
    const trimmed = image.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return undefined;

    // Normaliza http→https para dominios que lo soporten; los de BLOCKED_IMAGE_HOSTS
    // se procesarán después en reHostImageIfNeeded (descarga + resubida a Cloudinary).
    if (/^http:\/\//i.test(trimmed)) {
      return trimmed.replace(/^http:/i, 'https:');
    }

    return trimmed;
  }

  private extractPriceRangeFromTextStable(
    text: string
  ): { precioMin: number; precioMax: number } | null {
    const match = text.match(
      /(\d+(?:[.,]\d+)?)\s*(?:\u20ac|eur|euros?)?\s*(?:-|–|—|a\b|hasta\b|y\b)\s*(\d+(?:[.,]\d+)?)\s*(?:\u20ac|eur|euros?)/i
    );
    if (!match) return null;

    const first = this.toNonNegativeNumberOrNull(match[1].replace(',', '.'));
    const second = this.toNonNegativeNumberOrNull(match[2].replace(',', '.'));
    if (first == null || second == null || first === second) return null;

    return {
      precioMin: Math.min(first, second),
      precioMax: Math.max(first, second),
    };
  }

  private extractPriceRangeFromText(text: string): { precioMin: number; precioMax: number } | null {
    // El primer número debe ir seguido de € (o "euros"), o el separador debe ser
    // un guion/dash/em-dash (no "a"/"hasta"/"y"), para evitar falsos positivos
    // en frases como "exposición de 10 a 20 artistas con entrada de 5€".
    const match = text.match(
      /(\d+(?:[.,]\d+)?)\s*€\s*(?:-|–|—|a\b|hasta\b|y\b)\s*(\d+(?:[.,]\d+)?)\s*(?:€|euros?)|(\d+(?:[.,]\d+)?)\s*(?:-|–|—)\s*(\d+(?:[.,]\d+)?)\s*(?:€|euros?)/i
    );
    if (!match) return null;

    const rawFirst = match[1] ?? match[3];
    const rawSecond = match[2] ?? match[4];

    const first = this.toNonNegativeNumberOrNull(rawFirst.replace(',', '.'));
    const second = this.toNonNegativeNumberOrNull(rawSecond.replace(',', '.'));

    if (first == null || second == null || first === second) return null;

    return {
      precioMin: Math.min(first, second),
      precioMax: Math.max(first, second),
    };
  }

  private toNonNegativeNumberOrNull(value: unknown): number | null {
    if (value == null) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return parsed;
  }

  private async resolveCategory(scrapedEvent: ScrapedEvent): Promise<Categoria> {
    if (scrapedEvent.categoriaId) {
      const existingById = await this.categoriaRepo.findOne({
        where: { id: scrapedEvent.categoriaId },
      });
      if (existingById) return existingById;
    }

    const hint = scrapedEvent.categoriaHint?.trim();
    let nameToNormalize = hint;
    if (!nameToNormalize || nameToNormalize.toLowerCase() === 'otros') {
      nameToNormalize = this.inferCategoryName(scrapedEvent);
    }
    return this.getOrCreateCategory(this.normalizeCategoryName(nameToNormalize));
  }

  private inferCategoryName(scrapedEvent: ScrapedEvent): string {
    const text = `${scrapedEvent.title} ${scrapedEvent.description}`.toLowerCase();

    if (
      /(concierto|music|musica|flamenco|dj|festival|banda|orquesta|electr[oó]nica|jazz|rock|pop|ticketmaster)/.test(
        text
      )
    ) {
      return 'Conciertos';
    }

    if (
      /(tapa|gastron|food|cena|almuerzo|degustaci|vino|cerveza|restaurante|brunch|cocktail)/.test(
        text
      )
    ) {
      return 'Gastronomía';
    }

    if (
      /(teatro|museo|arte|exposici|cine|documental|cultural|poes|literatura|opera|danza|baile)/.test(
        text
      )
    ) {
      return 'Cultura';
    }

    if (
      /(running|futbol|baloncesto|deporte|yoga|pilates|fitness|carrera|bike|crossfit|wellness)/.test(
        text
      )
    ) {
      return 'Deportes';
    }

    if (
      /(networking|startup|emprend|tech|tecnolog|business|career|job|feria de empleo|conferencia|summit|meetup)/.test(
        text
      )
    ) {
      return 'Networking';
    }

    if (
      /(congreso|seminar|ponencia|jornada t[eé]cnica|simposio|research|investigaci[oó]n)/.test(text)
    ) {
      return 'Conferencias';
    }

    if (/(taller|workshop|curso|clase|masterclass|seminario|formaci)/.test(text)) {
      return 'Talleres';
    }

    if (/(niñ|infantil|familia|kids|beb|escuela)/.test(text)) {
      return 'Infantil';
    }

    if (/(visita|tour|ruta guiada|misteriosa|patrimonio|monumento|catedral|alcazar)/.test(text)) {
      return 'Turismo';
    }

    if (/(solidari|benefic|voluntari|ong|charity|fundraiser)/.test(text)) {
      return 'Solidario';
    }

    if (/(fiesta|ocio|noche|party|discoteca|escape room|tour|ruta)/.test(text)) {
      return 'Ocio';
    }

    return 'Otros';
  }

  private async getOrCreateCategory(nombre: string): Promise<Categoria> {
    const normalizedName = this.normalizeCategoryName(nombre);
    const normalized = normalizedName.trim().toLowerCase();
    const cached = this.categoriaCache.get(normalized);
    if (cached) return cached;

    const existing = await this.categoriaRepo
      .createQueryBuilder('categoria')
      .where('LOWER(TRIM(categoria.nombre)) = :normalized', { normalized })
      .getOne();

    if (existing) {
      this.categoriaCache.set(normalized, existing);
      return existing;
    }

    const descriptions: Record<string, string> = {
      mercadillo: 'Mercadillos, mercados y ferias de productos.',
      fiestas: 'Fiestas populares, ferias y celebraciones.',
      concursos: 'Concursos, certámenes y competiciones.',
      conciertos: 'Música en vivo, recitales y festivales.',
      gastronomía: 'Rutas, catas y experiencias gastronómicas.',
      cultura: 'Teatro, arte, cine y actividades culturales.',
      deportes: 'Eventos deportivos y actividades de bienestar.',
      networking: 'Encuentros profesionales, negocios y tecnología.',
      conferencias: 'Congresos, charlas y ponencias especializadas.',
      talleres: 'Talleres, cursos y actividades formativas.',
      infantil: 'Actividades para niños y familias.',
      turismo: 'Visitas guiadas y experiencias turísticas locales.',
      solidario: 'Eventos benéficos y acciones solidarias.',
      ocio: 'Planes de ocio, rutas y entretenimiento.',
      otros: 'Eventos variados sin categoría específica.',
    };

    const created = this.categoriaRepo.create({
      nombre: normalizedName,
      descripcion: descriptions[normalized] ?? 'Eventos clasificados automáticamente por scraping.',
    });

    const saved = await this.categoriaRepo.save(created);
    this.categoriaCache.set(normalized, saved);
    return saved;
  }

  private normalizeCategoryName(value: string): string {
    const text = value.trim().toLowerCase();
    if (!text) return 'Otros';

    if (
      /(concert|music|musica|concierto(s)?|tributo|banda|orquesta|flamenco(s)?|festival(es)?|show|espect[aá]culo|directo|live|ac[uú]stic[oa]|jazz|rock|pop|dj|electr[oó]nica|indie|folk|blues|reggae|metal|punk|soul|gospel|trap|rap|hip hop|hip-hop|r&b|country|cantautor|recital|performing)/.test(
        text
      )
    )
      return 'Conciertos';
    if (/(food|drink|gastronom(ía|ia)?|restaurante(s)?|tapa(s)?|vino(s)?|culinary)/.test(text))
      return 'Gastronomía';
    if (
      /(art(e)?|culture|cultura(s)?|theatre|teatro(s)?|cine|museum|museo(s)?|exposici[oó]n(es)?)/.test(
        text
      )
    )
      return 'Cultura';
    if (
      /(sport(s)?|deporte(s)?|fitness|wellness|running|yoga|pilates|mundial|remo|baloncesto|fútbol|futbol|tenis|padel|natación|natacion|ciclismo|atletismo|voleibol|hockey|rugby|golf|boxeo|karate|judo|taekwondo|motociclismo|automovilismo|escalada|surf|skate|bmx|triatlón|triatlon|maratón|maraton|senderismo|montañismo|esquí|esqui|snowboard|patinaje|ajedrez|ping pong|tenis de mesa|bádminton|badminton|esgrima|lucha|halterofilia|gimnasia|parkour|parkur)/.test(
        text
      )
    )
      return 'Deportes';
    if (/(network(ing)?|startup(s)?|business|career|tech|empleo(s)?|job(s)?)/.test(text))
      return 'Networking';
    if (/(conference(s)?|congreso(s)?|seminar(io|ios)?|ponencia(s)?|summit(s)?)/.test(text))
      return 'Conferencias';
    if (/(workshop(s)?|taller(es)?|curso(s)?|class(es)?|formaci[oó]n(es)?)/.test(text))
      return 'Talleres';
    if (/(kids?|children|infantil(es)?|familia(s)?|family)/.test(text)) return 'Infantil';
    if (/(tour(s)?|ruta(s)?|visita(s)?|turismo|travel)/.test(text)) return 'Turismo';
    if (/(charity|solidari(o|os|a|as)?|ong|voluntari(o|os|a|as)?|benefic(o|os|a|as)?)/.test(text))
      return 'Solidario';
    if (/(party|nightlife|ocio(s)?|escape room|leisure)/.test(text)) return 'Ocio';
    if (/(mercadillo(s)?|mercado(s)?|rastrillo(s)?|flea market|market)/.test(text))
      return 'Mercadillo';
    if (
      /(concurso(s)?|competici[oó]n(es)?|torneo(s)?|certamen(es)?|challenge(s)?|contest(s)?)/.test(
        text
      )
    )
      return 'Concursos';
    if (
      /(fiesta(s)?|feria(s)?|verbena(s)?|romería(s)?|romeria(s)?|carnaval(es)?|san fermín|sanfermin|san juan|sanjuan|navidad|halloween|nochevieja|noche buena|nochebuena|fin de año|findeaño|findeano|reyes magos|reyesmagos|cabalgata|procesi[oó]n(es)?|semana santa|semana-santa|fallas|hogueras|magosto|magosta|fiestas patronales|patronal(es)?|patr[oó]n(es)?)/.test(
        text
      )
    )
      return 'Fiestas';

    return 'Otros';
  }

  private async backfillUncategorizedScrapedEvents(): Promise<void> {
    const uncategorized = await this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.creador', 'creador')
      .leftJoinAndSelect('event.categoria', 'categoria')
      .where('categoria.id IS NULL')
      .andWhere('(creador.firebaseUid = :scraperUid OR creador.email = :legacyEmail)', {
        scraperUid: this.scraperSystemUid,
        legacyEmail: this.legacyScraperEmail,
      })
      .getMany();

    if (!uncategorized.length) return;

    for (const event of uncategorized) {
      try {
        const categoria = await this.resolveCategory({
          title: event.title ?? '',
          description: event.description ?? '',
          address: event.address,
          location: event.location,
          fechaInicio: event.fechaInicio,
          fechaFin: event.fechaFin,
          precio: event.precio ?? null,
          precioMin: event.precioMin ?? null,
          precioMax: event.precioMax ?? null,
        });

        await this.eventRepo
          .createQueryBuilder()
          .update(Event)
          .set({ categoria: { id: categoria.id } as Categoria })
          .where('id = :id', { id: event.id })
          .execute();
      } catch (error) {
        this.logger.warn(`No se pudo asignar categoría al evento ${event.id}`);
      }
    }
  }

  async deleteAllEvents(): Promise<{ deleted: number }> {
    const result = await this.eventRepo.delete({});
    const deleted = result.affected ?? 0;
    this.logger.log(`Eventos eliminados: ${deleted}`);
    return { deleted };
  }
}
