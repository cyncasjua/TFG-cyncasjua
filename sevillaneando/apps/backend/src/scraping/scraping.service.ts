import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '../events/event.entity';
import { Categoria } from '../entities/categoria.entity';
import { User } from '../users/user.entity';
import { IScraper, ScrapedEvent } from './interfaces/scraper.interface';
import { EstadoEnum } from '../enums/estado.enum';
import { SevillaScraperService } from './scrapers/sevilla-scraper.service';
import { TicketmasterScraperService } from './scrapers/ticketmaster-scraper.service';

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);
  private readonly categoriaCache = new Map<string, Categoria>();
  private readonly scraperSystemUid = process.env.SCRAPER_SYSTEM_UID || 'system-scraper-uid';
  private readonly scraperSystemEmail = process.env.SCRAPER_SYSTEM_EMAIL || 'scraper.bot@sevillaneando.local';
  private readonly scraperSystemName = process.env.SCRAPER_SYSTEM_NAME || 'Sevillaneando Bot';
  private readonly legacyScraperEmail = process.env.LEGACY_SCRAPER_EMAIL || 'mod@demo.com';

  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(Categoria)
    private readonly categoriaRepo: Repository<Categoria>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly moduleRef: ModuleRef,
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

        this.logger.log(`${scraper.name}: ${events.length} eventos encontrados, ${saved} guardados`);
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

    for (const scrapedEvent of scrapedEvents) {
      try {
        const batchKey = this.getDuplicateKey(scrapedEvent.title);
        if (seenInBatch.has(batchKey)) {
          this.logger.debug(`Evento duplicado en lote, omitido: ${scrapedEvent.title}`);
          continue;
        }

        const existingEvent = await this.eventRepo
          .createQueryBuilder('event')
          .leftJoinAndSelect('event.creador', 'creador')
          .where('LOWER(TRIM(event.title)) = LOWER(TRIM(:title))', {
            title: scrapedEvent.title,
          })
          .getOne();

        if (existingEvent) {
          const isScraperOwned =
            existingEvent.creador?.firebaseUid === this.scraperSystemUid ||
            existingEvent.creador?.email === this.legacyScraperEmail;

          if (isScraperOwned) {
            const categoria = await this.resolveCategory(scrapedEvent);
            existingEvent.description = scrapedEvent.description;
            existingEvent.address = scrapedEvent.address;
            existingEvent.location = scrapedEvent.location;
            existingEvent.fechaInicio = scrapedEvent.fechaInicio;
            existingEvent.fechaFin = scrapedEvent.fechaFin;
            existingEvent.precio = scrapedEvent.precio;
            existingEvent.precioMin = scrapedEvent.precioMin;
            existingEvent.precioMax = scrapedEvent.precioMax;
            existingEvent.imagen = scrapedEvent.imagen;
            existingEvent.imagenes = scrapedEvent.imagenes;
            existingEvent.estado = EstadoEnum.Aprobado;
            existingEvent.creador = systemUser;
            existingEvent.privado = false;
            existingEvent.categoria = categoria;

            await this.eventRepo.save(existingEvent);
            savedCount++;
            this.logger.debug(`Evento existente actualizado: ${scrapedEvent.title}`);
          } else {
            this.logger.debug(`Evento ya existe (creación manual), se omite: ${scrapedEvent.title}`);
          }

          seenInBatch.add(batchKey);
          continue;
        }

        const categoria = await this.resolveCategory(scrapedEvent);
        const event = this.eventRepo.create({
          title: scrapedEvent.title,
          description: scrapedEvent.description,
          address: scrapedEvent.address,
          location: scrapedEvent.location,
          fechaInicio: scrapedEvent.fechaInicio,
          fechaFin: scrapedEvent.fechaFin,
          precio: scrapedEvent.precio,
          precioMin: scrapedEvent.precioMin,
          precioMax: scrapedEvent.precioMax,
          imagen: scrapedEvent.imagen,
          imagenes: scrapedEvent.imagenes,
          estado: EstadoEnum.Aprobado,
          creador: systemUser,
          privado: false,
          categoria,
        });

        await this.eventRepo.save(event);
        seenInBatch.add(batchKey);
        savedCount++;
        this.logger.debug(`Evento guardado: ${scrapedEvent.title}`);
      } catch (error) {
        this.logger.error(`Error guardando evento "${scrapedEvent.title}":`, error);
      }
    }

    return savedCount;
  }

  getAvailableScrapers(): string[] {
    return this.getConfiguredScrapers().map((s) => s.name);
  }

  private getConfiguredScrapers(): IScraper[] {
    const scrapers: IScraper[] = [];

    const sevillaScraperService = this.moduleRef.get(SevillaScraperService, { strict: false });
    const ticketmasterScraperService = this.moduleRef.get(TicketmasterScraperService, { strict: false });

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

    this.logger.log(`Scrapers activos: ${scrapers.map((s) => s.name).join(', ') || 'ninguno'}`);
    return scrapers;
  }

  private getDuplicateKey(title: string): string {
    const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, ' ');
    return normalizedTitle;
  }

  private async resolveCategory(scrapedEvent: ScrapedEvent): Promise<Categoria> {
    if (scrapedEvent.categoriaId) {
      const existingById = await this.categoriaRepo.findOne({ where: { id: scrapedEvent.categoriaId } });
      if (existingById) return existingById;
    }

    const hint = scrapedEvent.categoriaHint?.trim();
    if (hint) {
      return this.getOrCreateCategory(this.normalizeCategoryName(hint));
    }

    const inferredName = this.inferCategoryName(scrapedEvent);
    return this.getOrCreateCategory(inferredName);
  }

  private inferCategoryName(scrapedEvent: ScrapedEvent): string {
    const text = `${scrapedEvent.title} ${scrapedEvent.description}`.toLowerCase();

    if (/(concierto|music|musica|flamenco|dj|festival|banda|orquesta|electr[oó]nica|jazz|rock|pop)/.test(text)) {
      return 'Conciertos';
    }

    if (/(tapa|gastron|food|cena|almuerzo|degustaci|vino|cerveza|restaurante|brunch|cocktail)/.test(text)) {
      return 'Gastronomía';
    }

    if (/(teatro|museo|arte|exposici|cine|documental|cultural|poes|literatura|opera|danza|baile)/.test(text)) {
      return 'Cultura';
    }

    if (/(running|futbol|baloncesto|deporte|yoga|pilates|fitness|carrera|bike|crossfit|wellness)/.test(text)) {
      return 'Deportes';
    }

    if (/(networking|startup|emprend|tech|tecnolog|business|career|job|feria de empleo|conferencia|summit|meetup)/.test(text)) {
      return 'Networking';
    }

    if (/(congreso|seminar|ponencia|jornada t[eé]cnica|simposio|research|investigaci[oó]n)/.test(text)) {
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
      conciertos: 'Música en vivo, recitales y festivales.',
      'gastronomía': 'Rutas, catas y experiencias gastronómicas.',
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

    if (/(concert|music|musica|concierto|festival|flamenco|performing)/.test(text)) return 'Conciertos';
    if (/(food|drink|gastronom|restaurante|tapas|vino|culinary)/.test(text)) return 'Gastronomía';
    if (/(art|culture|cultura|theatre|teatro|cine|museum|museo)/.test(text)) return 'Cultura';
    if (/(sport|deporte|fitness|wellness|running|yoga|pilates)/.test(text)) return 'Deportes';
    if (/(network|startup|business|career|tech|empleo|job)/.test(text)) return 'Networking';
    if (/(conference|congreso|seminar|ponencia|summit)/.test(text)) return 'Conferencias';
    if (/(workshop|taller|curso|class|formaci)/.test(text)) return 'Talleres';
    if (/(kids|children|infantil|familia|family)/.test(text)) return 'Infantil';
    if (/(tour|ruta|visita|turismo|travel)/.test(text)) return 'Turismo';
    if (/(charity|solidari|ong|voluntari|benefic)/.test(text)) return 'Solidario';
    if (/(party|nightlife|ocio|escape room|leisure)/.test(text)) return 'Ocio';

    return text.charAt(0).toUpperCase() + text.slice(1);
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
