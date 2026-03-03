import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ServiceStatus } from '../../common/enums';
import { Client } from '../client/client.entity';

@Entity('services')
export class Service {
  @PrimaryColumn({ length: 11 })
  id: string;

  @Column({ name: 'client_id', length: 11 })
  clientId: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ length: 500 })
  description: string;

  @Column({ name: 'service_date', type: 'date' })
  serviceDate: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: ServiceStatus, default: ServiceStatus.PENDING })
  status: ServiceStatus;
}
