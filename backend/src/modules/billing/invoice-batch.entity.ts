import { Entity, Column, PrimaryColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { InvoiceBatchStatus } from '../../common/enums';
import { ReceiptBook } from '../receipt-book/receipt-book.entity';
import { Invoice } from './invoice.entity';

@Entity('invoice_batches')
export class InvoiceBatch {
  @PrimaryColumn({ length: 11 })
  id: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: Date;

  @Column({ name: 'receipt_book_id', length: 11 })
  receiptBookId: string;

  @ManyToOne(() => ReceiptBook)
  @JoinColumn({ name: 'receipt_book_id' })
  receiptBook: ReceiptBook;

  @Column({ type: 'enum', enum: InvoiceBatchStatus })
  status: InvoiceBatchStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ name: 'invoice_count' })
  invoiceCount: number;

  @OneToMany(() => Invoice, (invoice) => invoice.batch)
  invoices: Invoice[];
}
