import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Client } from './client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { generateCustomId, ID_PREFIXES, ID_SEQUENCES } from '../../common/id-generator';
import { BusinessException } from '../../common/errors/business.exception';
import { ErrorCode } from '../../common/errors/error-codes';

@Injectable()
export class ClientService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateClientDto): Promise<Client> {
    const id = await generateCustomId(
      this.dataSource,
      ID_PREFIXES.CLIENT,
      ID_SEQUENCES.CLIENT,
    );
    const client = this.clientRepo.create({ ...dto, id });
    return this.clientRepo.save(client);
  }

  findAll(): Promise<Client[]> {
    return this.clientRepo.find();
  }

  async findOne(id: string): Promise<Client> {
    const client = await this.clientRepo.findOneBy({ id });
    if (!client) throw new BusinessException(HttpStatus.NOT_FOUND, ErrorCode.CLIENT_NOT_FOUND, `El cliente ${id} no existe`);
    return client;
  }

  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(id);
    Object.assign(client, dto);
    return this.clientRepo.save(client);
  }

  async remove(id: string): Promise<void> {
    const client = await this.findOne(id);
    await this.clientRepo.remove(client);
  }
}
