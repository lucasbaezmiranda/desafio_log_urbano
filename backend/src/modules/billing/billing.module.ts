import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingPending } from './billing-pending.entity';
import { InvoiceBatch } from './invoice-batch.entity';
import { Invoice } from './invoice.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BillingPending, InvoiceBatch, Invoice])],
  exports: [TypeOrmModule],
})
export class BillingModule {}
