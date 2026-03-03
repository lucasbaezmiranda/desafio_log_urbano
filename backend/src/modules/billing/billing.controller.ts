import { Controller, Get, Post, Body, Param, HttpCode } from '@nestjs/common';
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

  /**
   * Endpoint público: envía a SQS (async) o procesa directamente si SQS no está configurado.
   * Retorna 202 Accepted cuando se encola, o 200 con el batch si es sincrónico.
   */
  @Post('process')
  @HttpCode(202)
  async process(@Body() dto: ProcessBillingDto) {
    const result = await this.billingService.processAsync(dto.receiptBookId);
    if (result.batch) {
      return { status: 'completed', batch: result.batch };
    }
    return { status: 'queued', message: 'Billing processing queued' };
  }

  /**
   * Endpoint interno: usado por Lambda para ejecutar el procesamiento real.
   */
  @Post('process-sync')
  processSync(@Body() dto: ProcessBillingDto) {
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
