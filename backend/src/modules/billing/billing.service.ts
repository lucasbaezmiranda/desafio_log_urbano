import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BillingPending } from './billing-pending.entity';
import { InvoiceBatch } from './invoice-batch.entity';
import { Invoice } from './invoice.entity';
import { ReceiptBook } from '../receipt-book/receipt-book.entity';
import { BillingPendingStatus, InvoiceBatchStatus } from '../../common/enums';
import { generateCustomId, ID_PREFIXES, ID_SEQUENCES } from '../../common/id-generator';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly sqsClient: SQSClient | null;
  private readonly snsClient: SNSClient | null;
  private readonly sqsQueueUrl: string | undefined;
  private readonly snsTopicArn: string | undefined;

  constructor(
    @InjectRepository(BillingPending)
    private readonly pendingRepo: Repository<BillingPending>,
    @InjectRepository(InvoiceBatch)
    private readonly batchRepo: Repository<InvoiceBatch>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(ReceiptBook)
    private readonly receiptBookRepo: Repository<ReceiptBook>,
    private readonly dataSource: DataSource,
  ) {
    this.sqsQueueUrl = process.env.SQS_QUEUE_URL;
    this.snsTopicArn = process.env.SNS_TOPIC_ARN;
    const region = process.env.AWS_REGION || 'us-east-1';

    if (this.sqsQueueUrl) {
      this.sqsClient = new SQSClient({ region });
      this.logger.log(`SQS configured: ${this.sqsQueueUrl}`);
    } else {
      this.sqsClient = null;
      this.logger.log('SQS not configured, using synchronous processing');
    }

    if (this.snsTopicArn) {
      this.snsClient = new SNSClient({ region });
      this.logger.log(`SNS configured: ${this.snsTopicArn}`);
    } else {
      this.snsClient = null;
    }
  }

  /**
   * Async entry point: envía mensaje a SQS si está configurado,
   * o procesa sincrónicamente como fallback (local/dev).
   */
  async processAsync(receiptBookId: string): Promise<{ accepted: boolean; batch?: InvoiceBatch }> {
    // Validar antes de encolar
    const receiptBook = await this.receiptBookRepo.findOneBy({ id: receiptBookId });
    if (!receiptBook) throw new NotFoundException(`ReceiptBook ${receiptBookId} not found`);
    if (!receiptBook.isActive) throw new BadRequestException(`ReceiptBook ${receiptBookId} is not active`);

    const pendingCount = await this.pendingRepo.count({ where: { status: BillingPendingStatus.PENDING } });
    if (pendingCount === 0) throw new BadRequestException('No pending services to invoice');

    if (this.sqsClient && this.sqsQueueUrl) {
      await this.sqsClient.send(new SendMessageCommand({
        QueueUrl: this.sqsQueueUrl,
        MessageBody: JSON.stringify({ receiptBookId }),
      }));
      this.logger.log(`Billing message sent to SQS for receiptBook ${receiptBookId}`);
      return { accepted: true };
    }

    // Fallback sincrónico (para desarrollo local sin SQS)
    const batch = await this.process(receiptBookId);
    return { accepted: true, batch };
  }

  /**
   * Procesamiento sincrónico real (usado por Lambda o fallback local).
   */
  async process(receiptBookId: string): Promise<InvoiceBatch> {
    const receiptBook = await this.receiptBookRepo.findOneBy({ id: receiptBookId });
    if (!receiptBook) throw new NotFoundException(`ReceiptBook ${receiptBookId} not found`);
    if (!receiptBook.isActive) throw new BadRequestException(`ReceiptBook ${receiptBookId} is not active`);

    const pendings = await this.pendingRepo.find({
      where: { status: BillingPendingStatus.PENDING },
      relations: ['service'],
    });

    if (pendings.length === 0) throw new BadRequestException('No pending services to invoice');

    // Agrupar pendientes por cliente
    const byClient = new Map<string, BillingPending[]>();
    for (const pending of pendings) {
      const clientId = pending.service.clientId;
      if (!byClient.has(clientId)) byClient.set(clientId, []);
      byClient.get(clientId)!.push(pending);
    }

    // Ejecutar todo en una transacción
    const batch = await this.dataSource.transaction(async (manager) => {
      const batchId = await generateCustomId(this.dataSource, ID_PREFIXES.INVOICE_BATCH, ID_SEQUENCES.INVOICE_BATCH);

      // Crear el lote primero (las facturas tienen FK hacia él)
      const batch = manager.create(InvoiceBatch, {
        id: batchId,
        issueDate: new Date(),
        receiptBookId,
        status: InvoiceBatchStatus.PROCESSED,
        totalAmount: 0,
        invoiceCount: byClient.size,
      });
      await manager.save(batch);

      const invoices: Invoice[] = [];
      let batchTotal = 0;

      for (const [clientId, clientPendings] of byClient) {
        const invoiceId = await generateCustomId(this.dataSource, ID_PREFIXES.INVOICE, ID_SEQUENCES.INVOICE);

        const totalAmount = clientPendings.reduce(
          (sum, p) => sum + Number(p.service.amount),
          0,
        );

        const invoiceNumber = `${String(receiptBook.pointOfSale).padStart(4, '0')}-${String(receiptBook.nextNumber).padStart(8, '0')}`;
        receiptBook.nextNumber++;

        const invoice = manager.create(Invoice, {
          id: invoiceId,
          batchId,
          clientId,
          invoiceNumber,
          issueDate: new Date(),
          totalAmount,
        });
        await manager.save(invoice);
        invoices.push(invoice);

        batchTotal += totalAmount;

        // Marcar pendientes como facturados
        for (const pending of clientPendings) {
          pending.status = BillingPendingStatus.INVOICED;
          pending.invoiceId = invoiceId;
          await manager.save(pending);
        }
      }

      // Actualizar totales del lote y nextNumber del talonario
      batch.totalAmount = batchTotal;
      await manager.save(batch);
      await manager.save(receiptBook);

      batch.invoices = invoices;
      return batch;
    });

    // Notificar vía SNS si está configurado
    if (this.snsClient && this.snsTopicArn) {
      try {
        await this.snsClient.send(new PublishCommand({
          TopicArn: this.snsTopicArn,
          Subject: `Lote de facturación ${batch.id} procesado`,
          Message: [
            `Lote: ${batch.id}`,
            `Facturas generadas: ${batch.invoiceCount}`,
            `Monto total: $${Number(batch.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
            `Fecha: ${batch.issueDate}`,
          ].join('\n'),
        }));
      } catch (err) {
        this.logger.error(`Failed to send SNS notification: ${err}`);
      }
    }

    return batch;
  }

  async findBatch(id: string): Promise<InvoiceBatch> {
    const batch = await this.batchRepo.findOne({
      where: { id },
      relations: ['invoices', 'invoices.client', 'invoices.items', 'invoices.items.service', 'receiptBook'],
    });
    if (!batch) throw new NotFoundException(`Batch ${id} not found`);
    return batch;
  }

  findAllBatches(): Promise<InvoiceBatch[]> {
    return this.batchRepo.find({ relations: ['receiptBook'] });
  }
}
