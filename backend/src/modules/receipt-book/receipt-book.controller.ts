import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ReceiptBookService } from './receipt-book.service';
import { CreateReceiptBookDto } from './dto/create-receipt-book.dto';
import { UpdateReceiptBookDto } from './dto/update-receipt-book.dto';

@Controller('receipt-books')
export class ReceiptBookController {
  constructor(private readonly receiptBookService: ReceiptBookService) {}

  @Post()
  create(@Body() dto: CreateReceiptBookDto) {
    return this.receiptBookService.create(dto);
  }

  @Get()
  findAll() {
    return this.receiptBookService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.receiptBookService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReceiptBookDto) {
    return this.receiptBookService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.receiptBookService.remove(id);
  }
}
