import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingPendingService } from './billing-pending.service';
import { ProcessBillingDto } from './dto/process-billing.dto';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly billingPendingService: BillingPendingService,
  ) {}

  @Get('pending')
  findPending() {
    return this.billingPendingService.findAllPending();
  }

  @Post('process')
  process(@Body() dto: ProcessBillingDto) {
    return this.billingService.process(dto.receiptBookId);
  }

  @Get('batches')
  findAllBatches() {
    return this.billingService.findAllBatches();
  }

  @Get('batches/:id')
  findBatch(@Param('id') id: string) {
    return this.billingService.findBatch(id);
  }
}
