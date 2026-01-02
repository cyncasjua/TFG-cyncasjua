import { Repository, DataSource } from 'typeorm';
import { Event } from '../events/event.entity';

export const seedEvents = async (eventRepo: Repository<Event>, dataSource: DataSource) => {
  try {
    const count = await eventRepo.count();
    
    // Si ya hay eventos, no hacer nada
    if (count > 0) {
      console.log('✅ Eventos ya existen, saltando seed');
      return;
    }

    console.log('🌱 Iniciando seed de eventos de prueba...');

    const testEvents = [
      {
        title: 'Feria de Abril',
        description: 'Celebra la tradición sevillana con casetas, música y gastronomía local.',
        latitude: 37.3772,
        longitude: -6.0014,
        address: 'Recinto Ferial, Sevilla'
      },
      {
        title: 'Concierto en la Plaza de España',
        description: 'Música al aire libre con artistas locales e internacionales.',
        latitude: 37.3775,
        longitude: -5.9869,
        address: 'Plaza de España, Sevilla'
      },
      {
        title: 'Ruta gastronómica por Triana',
        description: 'Tapas y flamenco en uno de los barrios más emblemáticos de Sevilla.',
        latitude: 37.3822,
        longitude: -6.0077,
        address: 'Barrio de Triana, Sevilla'
      }
    ];

    for (const eventData of testEvents) {
      await dataSource.query(
        `INSERT INTO events (title, description, address, location) 
         VALUES ($1, $2, $3, ST_GeomFromText('POINT(' || $4 || ' ' || $5 || ')', 4326))`,
        [eventData.title, eventData.description, eventData.address, eventData.longitude, eventData.latitude]
      );
    }

    console.log(`✅ Se han creado ${testEvents.length} eventos de prueba`);
  } catch (error) {
    console.error('❌ Error al ejecutar seed:', error.message);
  }
};
