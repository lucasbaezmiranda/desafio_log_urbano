import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceStatusDto } from './dto/update-service-status.dto';

@Controller('services')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Post()
  create(@Body() dto: CreateServiceDto) {
    return this.serviceService.create(dto);
  }

  @Get()
  findAll(@Query('clientId') clientId?: string) {
    if (clientId) return this.serviceService.findByClient(clientId);
    return this.serviceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateServiceStatusDto) {
    return this.serviceService.updateStatus(id, dto);
  }
}
