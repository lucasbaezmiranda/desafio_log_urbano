import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('receipt_books')
export class ReceiptBook {
  @PrimaryColumn({ length: 11 })
  id: string;

  @Column({ name: 'point_of_sale', unique: true })
  pointOfSale: number;

  @Column({ length: 200 })
  description: string;

  @Column({ name: 'next_number', default: 1 })
  nextNumber: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
