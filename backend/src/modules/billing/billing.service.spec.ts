import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingPending } from './billing-pending.entity';
import { InvoiceBatch } from './invoice-batch.entity';
import { Invoice } from './invoice.entity';
import { ReceiptBook } from '../receipt-book/receipt-book.entity';
import { BillingPendingStatus } from '../../common/enums';

describe('BillingService', () => {
  let service: BillingService;

  const mockPendingRepo = { find: jest.fn() };
  const mockBatchRepo = { find: jest.fn(), findOne: jest.fn() };
  const mockInvoiceRepo = {};
  const mockReceiptBookRepo = { findOneBy: jest.fn() };

  let seqCounter = 0;
  const mockManager = {
    create: jest.fn((_entity, dto) => dto),
    save: jest.fn((entity) => Promise.resolve(entity)),
  };

  const mockDataSource = {
    query: jest.fn(() => {
      seqCounter++;
      return Promise.resolve([{ val: String(seqCounter) }]);
    }),
    transaction: jest.fn((cb) => cb(mockManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: getRepositoryToken(BillingPending), useValue: mockPendingRepo },
        { provide: getRepositoryToken(InvoiceBatch), useValue: mockBatchRepo },
        { provide: getRepositoryToken(Invoice), useValue: mockInvoiceRepo },
        { provide: getRepositoryToken(ReceiptBook), useValue: mockReceiptBookRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    jest.clearAllMocks();
    seqCounter = 0;
    mockDataSource.query.mockImplementation(() => {
      seqCounter++;
      return Promise.resolve([{ val: String(seqCounter) }]);
    });
    mockDataSource.transaction.mockImplementation((cb) => cb(mockManager));
  });

  it('should throw NotFoundException if receipt book not found', async () => {
    mockReceiptBookRepo.findOneBy.mockResolvedValue(null);

    await expect(service.process('TAL-9999999')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException if receipt book is inactive', async () => {
    mockReceiptBookRepo.findOneBy.mockResolvedValue({
      id: 'TAL-0000001',
      isActive: false,
    });

    await expect(service.process('TAL-0000001')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException if no pending services', async () => {
    mockReceiptBookRepo.findOneBy.mockResolvedValue({
      id: 'TAL-0000001',
      isActive: true,
    });
    mockPendingRepo.find.mockResolvedValue([]);

    await expect(service.process('TAL-0000001')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should process billing batch grouping by client', async () => {
    mockReceiptBookRepo.findOneBy.mockResolvedValue({
      id: 'TAL-0000001',
      pointOfSale: 1,
      nextNumber: 1,
      isActive: true,
    });

    mockPendingRepo.find.mockResolvedValue([
      {
        id: 'PEN-0000001',
        serviceId: 'SRV-0000001',
        status: BillingPendingStatus.PENDING,
        service: { id: 'SRV-0000001', clientId: 'CLI-0000001', amount: 10000 },
      },
      {
        id: 'PEN-0000002',
        serviceId: 'SRV-0000002',
        status: BillingPendingStatus.PENDING,
        service: { id: 'SRV-0000002', clientId: 'CLI-0000001', amount: 5000 },
      },
      {
        id: 'PEN-0000003',
        serviceId: 'SRV-0000003',
        status: BillingPendingStatus.PENDING,
        service: { id: 'SRV-0000003', clientId: 'CLI-0000002', amount: 20000 },
      },
    ]);

    const result = await service.process('TAL-0000001');

    // 2 clientes = 2 facturas
    expect(result.invoices).toHaveLength(2);
    expect(result.totalAmount).toBe(35000);
    expect(result.invoiceCount).toBe(2);

    // Factura del CLI-0000001 agrupa 2 servicios
    const inv1 = result.invoices.find((i: any) => i.clientId === 'CLI-0000001');
    expect(inv1!.totalAmount).toBe(15000);

    // Factura del CLI-0000002 tiene 1 servicio
    const inv2 = result.invoices.find((i: any) => i.clientId === 'CLI-0000002');
    expect(inv2!.totalAmount).toBe(20000);
  });

  it('should mark pendings as INVOICED after processing', async () => {
    mockReceiptBookRepo.findOneBy.mockResolvedValue({
      id: 'TAL-0000001',
      pointOfSale: 1,
      nextNumber: 1,
      isActive: true,
    });

    const pending = {
      id: 'PEN-0000001',
      serviceId: 'SRV-0000001',
      status: BillingPendingStatus.PENDING,
      invoiceId: null,
      service: { id: 'SRV-0000001', clientId: 'CLI-0000001', amount: 10000 },
    };
    mockPendingRepo.find.mockResolvedValue([pending]);

    await service.process('TAL-0000001');

    expect(pending.status).toBe(BillingPendingStatus.INVOICED);
    expect(pending.invoiceId).toBeDefined();
  });
});
