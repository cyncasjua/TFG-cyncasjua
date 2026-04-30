import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ruta } from '../entities/ruta.entity';
import { Event } from '../events/event.entity';
import { User } from '../users/user.entity';
import { CalificacionRuta } from '../entities/calificacion-ruta.entity';
import { CreateRutaDto } from './dto/create-ruta.dto';
import { UpdateRutaDto } from './dto/update-ruta.dto';

@Injectable()
export class RutasService {
  constructor(
    @InjectRepository(Ruta) private rutasRepository: Repository<Ruta>,
    @InjectRepository(Event) private eventsRepository: Repository<Event>,
    @InjectRepository(User) private usersRepository: Repository<User>,
    @InjectRepository(CalificacionRuta) private calificacionesRepository: Repository<CalificacionRuta>,
  ) {}

  async create(createRutaDto: CreateRutaDto, userId: string): Promise<Ruta> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (!createRutaDto.eventosIds || createRutaDto.eventosIds.length === 0) {
      throw new BadRequestException('Debe seleccionar al menos un evento');
    }

    const eventos = await this.eventsRepository.findByIds(createRutaDto.eventosIds);
    if (eventos.length !== createRutaDto.eventosIds.length) {
      throw new BadRequestException('Uno o más eventos no fueron encontrados');
    }

    const ruta = new Ruta();
    ruta.titulo = createRutaDto.titulo;
    ruta.descripcion = createRutaDto.descripcion || '';
    ruta.trayecto = createRutaDto.trayecto;
    ruta.secuenciaEventos = eventos;
    ruta.temporizacion = createRutaDto.temporizacion;
    ruta.creador = user;
    ruta.puntuacionPromedio = 0;
    ruta.numCalificaciones = 0;

    return this.rutasRepository.save(ruta);
  }

  async findAll(userId?: string): Promise<Ruta[]> {
    if (userId) {
      return this.rutasRepository.find({
        where: { creador: { id: userId } },
        relations: ['creador', 'secuenciaEventos'],
        order: { fechaCreacion: 'DESC' },
      });
    }

    return this.rutasRepository.find({
      relations: ['creador', 'secuenciaEventos'],
      order: { fechaCreacion: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Ruta> {
    const ruta = await this.rutasRepository.findOne({
      where: { id },
      relations: ['creador', 'secuenciaEventos'],
    });

    if (!ruta) throw new NotFoundException('Ruta no encontrada');
    return ruta;
  }

  async update(
    id: string,
    updateRutaDto: UpdateRutaDto,
    userId: string,
  ): Promise<Ruta> {
    const ruta = await this.findOne(id);

    if (ruta.creador.id !== userId) {
      throw new ForbiddenException('No tienes permisos para editar esta ruta');
    }

    if (updateRutaDto.titulo) ruta.titulo = updateRutaDto.titulo;
    if (updateRutaDto.descripcion) ruta.descripcion = updateRutaDto.descripcion;
    if (updateRutaDto.trayecto) ruta.trayecto = updateRutaDto.trayecto;
    if (updateRutaDto.temporizacion) ruta.temporizacion = updateRutaDto.temporizacion;

    if (updateRutaDto.eventosIds && updateRutaDto.eventosIds.length > 0) {
      const eventos = await this.eventsRepository.findByIds(updateRutaDto.eventosIds);
      if (eventos.length !== updateRutaDto.eventosIds.length) {
        throw new BadRequestException('Uno o más eventos no fueron encontrados');
      }
      ruta.secuenciaEventos = eventos;
    }

    return this.rutasRepository.save(ruta);
  }

  async remove(id: string, userId: string): Promise<void> {
    const ruta = await this.findOne(id);

    if (ruta.creador.id !== userId) {
      throw new ForbiddenException('No tienes permisos para eliminar esta ruta');
    }

    await this.rutasRepository.remove(ruta);
  }

  async rateRuta(
    id: string,
    puntuacion: number,
    userId: string,
  ): Promise<Ruta & { miCalificacion?: number }> {
    const ruta = await this.findOne(id);
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (puntuacion < 1 || puntuacion > 5) {
      throw new BadRequestException('La puntuación debe estar entre 1 y 5');
    }

    // Buscar si ya existe una calificación de este usuario
    let calificacion = await this.calificacionesRepository.findOne({
      where: { usuario: { id: userId }, ruta: { id } },
    });

    if (!calificacion) {
      calificacion = new CalificacionRuta();
      calificacion.usuario = user;
      calificacion.ruta = ruta;
      calificacion.puntuacion = puntuacion;
    } else {
      calificacion.puntuacion = puntuacion;
    }

    await this.calificacionesRepository.save(calificacion);

    // Recalcular promedio basado en todas las calificaciones
    const todasCalificaciones = await this.calificacionesRepository.find({
      where: { ruta: { id } },
    });

    const totalPuntos = todasCalificaciones.reduce((sum, cal) => sum + cal.puntuacion, 0);
    ruta.numCalificaciones = todasCalificaciones.length;
    ruta.puntuacionPromedio = todasCalificaciones.length > 0 ? totalPuntos / todasCalificaciones.length : 0;

    const rutaActualizada = await this.rutasRepository.save(ruta);

    // Asignar la calificación personal a la instancia con tipado correcto
    const resultado: Ruta & { miCalificacion?: number } = rutaActualizada;
    resultado.miCalificacion = calificacion.puntuacion;
    return resultado;
  }

  async searchRutas(query: string): Promise<Ruta[]> {
    return this.rutasRepository
      .createQueryBuilder('ruta')
      .where('ruta.titulo ILIKE :search', { search: `%${query}%` })
      .orWhere('ruta.descripcion ILIKE :search', { search: `%${query}%` })
      .leftJoinAndSelect('ruta.creador', 'creador')
      .leftJoinAndSelect('ruta.secuenciaEventos', 'eventos')
      .orderBy('ruta.fechaCreacion', 'DESC')
      .take(20)
      .getMany();
  }

  async getCalificacionUsuario(rutaId: string, userId: string): Promise<number | null> {
    const calificacion = await this.calificacionesRepository.findOne({
      where: { ruta: { id: rutaId }, usuario: { id: userId } },
    });
    return calificacion?.puntuacion ?? null;
  }
}
