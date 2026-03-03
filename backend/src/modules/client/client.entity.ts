import { Entity, Column, PrimaryColumn, OneToMany, BeforeInsert } from 'typeorm';
import { TaxCondition } from '../../common/enums';

@Entity('clients')
export class Client {
  @PrimaryColumn({ length: 11 })
  id: string;

  @Column({ name: 'business_name', length: 200 })
  businessName: string;

  @Column({ name: 'tax_id', length: 13, unique: true })
  taxId: string;

  @Column({ name: 'tax_condition', type: 'enum', enum: TaxCondition })
  taxCondition: TaxCondition;

  @Column({ length: 200 })
  email: string;
}
