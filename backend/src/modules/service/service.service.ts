import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Service } from './service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceStatusDto } from './dto/update-service-status.dto';
import { generateCustomId, ID_PREFIXES, ID_SEQUENCES } from '../../common/id-generator';
import { ServiceStatus } from '../../common/enums';
import { BillingPendingService } from '../billing/billing-pending.service';
import { BusinessException } from '../../common/errors/business.exception';
import { ErrorCode } from '../../common/errors/error-codes';

@Injectable()
export class ServiceService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    private readonly dataSource: DataSource,
    private readonly billingPendingService: BillingPendingService,
  ) {}

  async create(dto: CreateServiceDto): Promise<Service> {
    const id = await generateCustomId(
      this.dataSource,
      ID_PREFIXES.SERVICE,
      ID_SEQUENCES.SERVICE,
    );
    const service = this.serviceRepo.create({ ...dto, id });
    return this.serviceRepo.save(service);
  }

  findAll(): Promise<Service[]> {
    return this.serviceRepo.find({ relations: ['client'] });
  }

  findByClient(clientId: string): Promise<Service[]> {
    return this.serviceRepo.find({
      where: { clientId },
      relations: ['client'],
    });
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.serviceRepo.findOne({
      where: { id },
      relations: ['client'],
    });
    if (!service) throw new BusinessException(HttpStatus.NOT_FOUND, ErrorCode.SERVICE_NOT_FOUND, `El servicio ${id} no existe`);
    return service;
  }

  async updateStatus(id: string, dto: UpdateServiceStatusDto): Promise<Service> {
    const service = await this.findOne(id);
    service.status = dto.status;
    const saved = await this.serviceRepo.save(service);

    if (dto.status === ServiceStatus.DELIVERED) {
      await this.billingPendingService.createFromService(id);
    }

    return saved;
  }
}
