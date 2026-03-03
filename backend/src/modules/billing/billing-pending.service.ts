import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BillingPending } from './billing-pending.entity';
import { generateCustomId, ID_PREFIXES, ID_SEQUENCES } from '../../common/id-generator';

@Injectable()
export class BillingPendingService {
  constructor(
    @InjectRepository(BillingPending)
    private readonly pendingRepo: Repository<BillingPending>,
    private readonly dataSource: DataSource,
  ) {}

  async createFromService(serviceId: string): Promise<BillingPending> {
    const id = await generateCustomId(
      this.dataSource,
      ID_PREFIXES.BILLING_PENDING,
      ID_SEQUENCES.BILLING_PENDING,
    );
    const pending = this.pendingRepo.create({ id, serviceId });
    return this.pendingRepo.save(pending);
  }

  findAllPending(): Promise<BillingPending[]> {
    return this.pendingRepo.find({
      where: { status: 'PENDING' as any },
      relations: ['service', 'service.client'],
    });
  }
}
