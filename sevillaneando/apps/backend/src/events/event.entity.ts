import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'events' })
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 255 })
  address!: string;

  // Uso de tipo geography para PostGIS (lat, lon)
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location!: string;
}
