import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BillingPendingStatus } from '../../common/enums';
import { Service } from '../service/service.entity';
import { Invoice } from './invoice.entity';

@Entity('billing_pending')
export class BillingPending {
  @PrimaryColumn({ length: 11 })
  id: string;

  @Column({ name: 'service_id', length: 11, unique: true })
  serviceId: string;

  @ManyToOne(() => Service)
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ type: 'enum', enum: BillingPendingStatus, default: BillingPendingStatus.PENDING })
  status: BillingPendingStatus;

  @Column({ type: 'varchar', name: 'invoice_id', length: 11, nullable: true })
  invoiceId: string | null;

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice | null;
}
