import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ID_SEQUENCES } from './id-generator';

@Injectable()
export class SequencesInitializer implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    for (const seq of Object.values(ID_SEQUENCES)) {
      await this.dataSource.query(
        `CREATE SEQUENCE IF NOT EXISTS ${seq} START WITH 1 INCREMENT BY 1`,
      );
    }
  }
}
