import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceiptBook } from './receipt-book.entity';
import { ReceiptBookService } from './receipt-book.service';
import { ReceiptBookController } from './receipt-book.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ReceiptBook])],
  controllers: [ReceiptBookController],
  providers: [ReceiptBookService],
  exports: [ReceiptBookService],
})
export class ReceiptBookModule {}
