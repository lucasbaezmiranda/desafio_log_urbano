import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { InvoiceBatch } from './invoice-batch.entity';
import { Client } from '../client/client.entity';

@Entity('invoices')
export class Invoice {
  @PrimaryColumn({ length: 11 })
  id: string;

  @Column({ name: 'batch_id', length: 11 })
  batchId: string;

  @ManyToOne(() => InvoiceBatch, (batch) => batch.invoices)
  @JoinColumn({ name: 'batch_id' })
  batch: InvoiceBatch;

  @Column({ name: 'client_id', length: 11 })
  clientId: string;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'invoice_number', length: 20 })
  invoiceNumber: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: Date;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  cae: string | null;

  @Column({ name: 'cae_expiration_date', type: 'date', nullable: true })
  caeExpirationDate: Date | null;
}
