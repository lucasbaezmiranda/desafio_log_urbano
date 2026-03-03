import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { ClientService } from './client.service';
import { Client } from './client.entity';
import { TaxCondition } from '../../common/enums';

describe('ClientService', () => {
  let service: ClientService;

  const mockRepo = {
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve(entity)),
    find: jest.fn(),
    findOneBy: jest.fn(),
    remove: jest.fn(),
  };

  const mockDataSource = {
    query: jest.fn().mockResolvedValue([{ val: '1' }]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientService,
        { provide: getRepositoryToken(Client), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ClientService>(ClientService);
    jest.clearAllMocks();
    mockDataSource.query.mockResolvedValue([{ val: '1' }]);
  });

  it('should create a client with custom ID', async () => {
    const dto = {
      businessName: 'Test SA',
      taxId: '30-12345678-9',
      taxCondition: TaxCondition.RESPONSABLE_INSCRIPTO,
      email: 'test@test.com',
    };

    const result = await service.create(dto);

    expect(result.id).toBe('CLI-0000001');
    expect(result.businessName).toBe('Test SA');
    expect(mockDataSource.query).toHaveBeenCalledWith(
      "SELECT nextval('seq_client') AS val",
    );
  });

  it('should return all clients', async () => {
    const clients = [{ id: 'CLI-0000001' }, { id: 'CLI-0000002' }];
    mockRepo.find.mockResolvedValue(clients);

    const result = await service.findAll();

    expect(result).toEqual(clients);
  });

  it('should throw NotFoundException when client not found', async () => {
    mockRepo.findOneBy.mockResolvedValue(null);

    await expect(service.findOne('CLI-9999999')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should update a client', async () => {
    const existing = {
      id: 'CLI-0000001',
      businessName: 'Old Name',
      taxId: '30-12345678-9',
      taxCondition: TaxCondition.RESPONSABLE_INSCRIPTO,
      email: 'old@test.com',
    };
    mockRepo.findOneBy.mockResolvedValue(existing);

    const result = await service.update('CLI-0000001', {
      businessName: 'New Name',
    });

    expect(result.businessName).toBe('New Name');
  });
});
