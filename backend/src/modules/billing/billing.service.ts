import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BillingPending } from './billing-pending.entity';
import { InvoiceBatch } from './invoice-batch.entity';
import { Invoice } from './invoice.entity';
import { ReceiptBook } from '../receipt-book/receipt-book.entity';
import { BillingPendingStatus, InvoiceBatchStatus } from '../../common/enums';
import { generateCustomId, ID_PREFIXES, ID_SEQUENCES } from '../../common/id-generator';

@Injectable()
export class BillingService {
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
  ) {}

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
    return this.dataSource.transaction(async (manager) => {
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
  }

  async findBatch(id: string): Promise<InvoiceBatch> {
    const batch = await this.batchRepo.findOne({
      where: { id },
      relations: ['invoices', 'invoices.client', 'receiptBook'],
    });
    if (!batch) throw new NotFoundException(`Batch ${id} not found`);
    return batch;
  }

  findAllBatches(): Promise<InvoiceBatch[]> {
    return this.batchRepo.find({ relations: ['receiptBook'] });
  }
}
