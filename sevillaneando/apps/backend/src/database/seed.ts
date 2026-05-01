import { Repository, DataSource } from 'typeorm';
import { Event } from '../events/event.entity';
import { Categoria } from '../categorias/categoria.entity';
import { User } from '../users/user.entity';
import { EstadoEnum } from '../events/enums/estado.enum';
import type { GeoJsonPoint } from '../common/geojson-point';
import { Logger } from '@nestjs/common';

const logger = new Logger('SeedEvents');

export const seedEvents = async (eventRepo: Repository<Event>, dataSource: DataSource) => {
  try {
    const count = await eventRepo.count();
    if (count > 0) {
      logger.log('Eventos ya existen, saltando seed');
      return;
    }

    logger.log('Iniciando seed de eventos de prueba...');

    const categoriasRepo = dataSource.getRepository(Categoria);
    const categoriasExistentes = await categoriasRepo.count();
    let categorias: Categoria[] = [];
    if (categoriasExistentes === 0) {
      categorias = await categoriasRepo.save([
        categoriasRepo.create({
          nombre: 'Fiestas',
          descripcion: 'Eventos festivos y celebraciones',
        }),
        categoriasRepo.create({
          nombre: 'Conciertos',
          descripcion: 'Música en vivo y espectáculos',
        }),
        categoriasRepo.create({
          nombre: 'Gastronomía',
          descripcion: 'Rutas y eventos gastronómicos',
        }),
      ]);
      logger.log('Categorías de prueba creadas');
    } else {
      categorias = await categoriasRepo.find();
    }
    let categoria = categorias[0];

    if (!categoria) {
      categoria = dataSource.getRepository(Categoria).create({
        nombre: 'Fiestas',
        descripcion: 'Eventos festivos y celebraciones',
      });
      categoria = await dataSource.getRepository(Categoria).save(categoria);
      logger.log('Categoría de prueba creada');
    }

    let creador = await dataSource.getRepository(User).findOne({ where: {} });
    if (!creador) {
      creador = dataSource.getRepository(User).create({
        nombre: 'Usuario de Prueba',
        email: 'prueba@correo.com',
        contrasena: '123456',
      });
      creador = await dataSource.getRepository(User).save(creador);
      logger.log('Usuario de prueba creado');
    }

    const testEvents = [
      {
        title: 'Feria de Abril',
        description: 'Celebra la tradición sevillana con casetas, música y gastronomía local.',
        address: 'Recinto Ferial, Sevilla',
        location: { type: 'Point', coordinates: [-6.0014, 37.3772] } as GeoJsonPoint,
        fechaInicio: new Date('2026-04-10T18:00:00'),
        fechaFin: new Date('2026-04-17T23:59:00'),
        precio: 0,
        categoria,
        estado: EstadoEnum.Pendiente,
        creador,
        imagen:
          'https://legacy.visitasevilla.es/sites/default/files/styles/card_extended_page/public/extended_page/img_card_right/feria-de-abril-bloque-1.jpg?itok=83C_2NQm',
      },
      {
        title: 'Concierto en la Plaza de España',
        description: 'Música al aire libre con artistas locales e internacionales.',
        address: 'Plaza de España, Sevilla',
        location: { type: 'Point', coordinates: [-5.9869, 37.3775] } as GeoJsonPoint,
        fechaInicio: new Date('2026-05-01T20:00:00'),
        fechaFin: new Date('2026-05-01T23:00:00'),
        precio: 15,
        categoria,
        estado: EstadoEnum.Pendiente,
        creador,
        imagen:
          'https://s1.abcstatics.com/abc/www/multimedia/sevilla/2022/10/26/plaza-espana-sevilla-RGatPHKYapyCsuC8b7DAh8L-1240x768@abc.jpg',
      },
      {
        title: 'Ruta gastronómica por Triana',
        description: 'Tapas y flamenco en uno de los barrios más emblemáticos de Sevilla.',
        address: 'Barrio de Triana, Sevilla',
        location: { type: 'Point', coordinates: [-6.0077, 37.3822] } as GeoJsonPoint,
        fechaInicio: new Date('2026-06-05T12:00:00'),
        fechaFin: new Date('2026-06-05T18:00:00'),
        precio: 25,
        categoria,
        estado: EstadoEnum.Pendiente,
        creador,
        imagen:
          'https://sevillavisita.com/wp-content/uploads/2019/12/Portada-Tour-guiado-Triana.jpg',
      },
    ];

    for (const eventData of testEvents) {
      const event = eventRepo.create(eventData);
      await eventRepo.save(event);
    }

    logger.log(`Se han creado ${testEvents.length} eventos de prueba`);
  } catch (error) {
    logger.error('Error al ejecutar seed', error as Error);
  }
};
