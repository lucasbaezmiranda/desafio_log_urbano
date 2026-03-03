import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ReceiptBook } from './receipt-book.entity';
import { CreateReceiptBookDto } from './dto/create-receipt-book.dto';
import { UpdateReceiptBookDto } from './dto/update-receipt-book.dto';
import { generateCustomId, ID_PREFIXES, ID_SEQUENCES } from '../../common/id-generator';

@Injectable()
export class ReceiptBookService {
  constructor(
    @InjectRepository(ReceiptBook)
    private readonly receiptBookRepo: Repository<ReceiptBook>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateReceiptBookDto): Promise<ReceiptBook> {
    const id = await generateCustomId(
      this.dataSource,
      ID_PREFIXES.RECEIPT_BOOK,
      ID_SEQUENCES.RECEIPT_BOOK,
    );
    const receiptBook = this.receiptBookRepo.create({ ...dto, id });
    return this.receiptBookRepo.save(receiptBook);
  }

  findAll(): Promise<ReceiptBook[]> {
    return this.receiptBookRepo.find();
  }

  async findOne(id: string): Promise<ReceiptBook> {
    const receiptBook = await this.receiptBookRepo.findOneBy({ id });
    if (!receiptBook) throw new NotFoundException(`ReceiptBook ${id} not found`);
    return receiptBook;
  }

  async update(id: string, dto: UpdateReceiptBookDto): Promise<ReceiptBook> {
    const receiptBook = await this.findOne(id);
    Object.assign(receiptBook, dto);
    return this.receiptBookRepo.save(receiptBook);
  }

  async remove(id: string): Promise<void> {
    const receiptBook = await this.findOne(id);
    await this.receiptBookRepo.remove(receiptBook);
  }
}
