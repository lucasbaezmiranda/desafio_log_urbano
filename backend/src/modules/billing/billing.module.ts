import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingPending } from './billing-pending.entity';
import { InvoiceBatch } from './invoice-batch.entity';
import { Invoice } from './invoice.entity';
import { ReceiptBook } from '../receipt-book/receipt-book.entity';
import { BillingPendingService } from './billing-pending.service';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BillingPending, InvoiceBatch, Invoice, ReceiptBook]),
  ],
  controllers: [BillingController],
  providers: [BillingPendingService, BillingService],
  exports: [BillingPendingService],
})
export class BillingModule {}
