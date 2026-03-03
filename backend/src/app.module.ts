import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientModule } from './modules/client/client.module';
import { ServiceModule } from './modules/service/service.module';
import { BillingModule } from './modules/billing/billing.module';
import { ReceiptBookModule } from './modules/receipt-book/receipt-book.module';
import { SequencesInitializer } from './common/sequences.initializer';
import { HealthController } from './health.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      username: process.env.POSTGRES_USER || 'logurbano',
      password: process.env.POSTGRES_PASSWORD || 'logurbano_dev',
      database: process.env.POSTGRES_DB || 'logurbano',
      autoLoadEntities: true,
      synchronize: true,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    }),
    ClientModule,
    ServiceModule,
    BillingModule,
    ReceiptBookModule,
  ],
  controllers: [HealthController],
  providers: [SequencesInitializer],
})
export class AppModule {}
