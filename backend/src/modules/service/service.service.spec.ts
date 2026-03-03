import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ServiceService } from './service.service';
import { Service } from './service.entity';
import { BillingPendingService } from '../billing/billing-pending.service';
import { ServiceStatus } from '../../common/enums';

describe('ServiceService', () => {
  let service: ServiceService;
  let billingPendingService: BillingPendingService;

  const mockRepo = {
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve(entity)),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn().mockResolvedValue([{ val: '1' }]),
  };

  const mockBillingPendingService = {
    createFromService: jest.fn().mockResolvedValue({ id: 'PEN-0000001' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceService,
        { provide: getRepositoryToken(Service), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: BillingPendingService, useValue: mockBillingPendingService },
      ],
    }).compile();

    service = module.get<ServiceService>(ServiceService);
    billingPendingService = module.get<BillingPendingService>(BillingPendingService);
    jest.clearAllMocks();
    mockDataSource.query.mockResolvedValue([{ val: '1' }]);
  });

  it('should create a service with custom ID', async () => {
    const dto = {
      clientId: 'CLI-0000001',
      description: 'Envío test',
      serviceDate: '2026-03-03',
      amount: 10000,
    };

    const result = await service.create(dto);

    expect(result.id).toBe('SRV-0000001');
    expect(result.clientId).toBe('CLI-0000001');
  });

  it('should create billing pending when status changes to DELIVERED', async () => {
    const existing = {
      id: 'SRV-0000001',
      clientId: 'CLI-0000001',
      status: ServiceStatus.PENDING,
      client: { id: 'CLI-0000001' },
    };
    mockRepo.findOne.mockResolvedValue(existing);

    await service.updateStatus('SRV-0000001', {
      status: ServiceStatus.DELIVERED,
    });

    expect(billingPendingService.createFromService).toHaveBeenCalledWith(
      'SRV-0000001',
    );
  });

  it('should NOT create billing pending for non-DELIVERED status', async () => {
    const existing = {
      id: 'SRV-0000001',
      clientId: 'CLI-0000001',
      status: ServiceStatus.PENDING,
      client: { id: 'CLI-0000001' },
    };
    mockRepo.findOne.mockResolvedValue(existing);

    await service.updateStatus('SRV-0000001', {
      status: ServiceStatus.IN_TRANSIT,
    });

    expect(billingPendingService.createFromService).not.toHaveBeenCalled();
  });
});
