import { Repository } from 'typeorm';
import { Event } from '../events/event.entity';

export const seedEvents = async (eventRepo: Repository<Event>) => {
  try {
    const count = await eventRepo.count();
    
    // Si ya hay eventos, no hacer nada
    if (count > 0) {
      console.log('✅ Eventos ya existen, saltando seed');
      return;
    }

    console.log('ℹ️ Seed de eventos desactivado. Crea eventos a través de la API.');
  } catch (error) {
    console.error('❌ Error al verificar eventos:', error.message);
  }
};
