import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClientService } from './modules/client/client.service';
import { ReceiptBookService } from './modules/receipt-book/receipt-book.service';
import { ServiceService } from './modules/service/service.service';
import { BillingService } from './modules/billing/billing.service';
import { BillingPendingService } from './modules/billing/billing-pending.service';
import { ServiceStatus } from './common/enums';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const clientService = app.get(ClientService);
  const receiptBookService = app.get(ReceiptBookService);
  const serviceService = app.get(ServiceService);
  const billingService = app.get(BillingService);
  const billingPendingService = app.get(BillingPendingService);

  console.log('=== Seeding database ===\n');

  // Crear clientes
  const client1 = await clientService.create({
    businessName: 'Transportes del Sur S.A.',
    taxId: '30-71234567-9',
    taxCondition: 'RESPONSABLE_INSCRIPTO' as any,
    email: 'admin@transportesdelsur.com.ar',
  });
  console.log(`Cliente creado: ${client1.id} - ${client1.businessName}`);

  const client2 = await clientService.create({
    businessName: 'Logística Rápida SRL',
    taxId: '30-71987654-2',
    taxCondition: 'MONOTRIBUTO' as any,
    email: 'contacto@logisticarapida.com.ar',
  });
  console.log(`Cliente creado: ${client2.id} - ${client2.businessName}`);

  const client3 = await clientService.create({
    businessName: 'Distribuidora Norte',
    taxId: '20-34567890-1',
    taxCondition: 'RESPONSABLE_INSCRIPTO' as any,
    email: 'ventas@distnorte.com.ar',
  });
  console.log(`Cliente creado: ${client3.id} - ${client3.businessName}`);

  // Crear talonario
  const receiptBook = await receiptBookService.create({
    pointOfSale: 2,
    description: 'Punto de venta sede central',
  });
  console.log(`\nTalonario creado: ${receiptBook.id} - PV ${receiptBook.pointOfSale}`);

  // Crear servicios para cliente 1
  const svc1 = await serviceService.create({
    clientId: client1.id,
    description: 'Envío CABA a Rosario - 1200kg maquinaria',
    serviceDate: '2026-03-01',
    amount: 45000,
  });
  const svc2 = await serviceService.create({
    clientId: client1.id,
    description: 'Envío CABA a Córdoba - 800kg insumos',
    serviceDate: '2026-03-02',
    amount: 38000,
  });

  // Crear servicios para cliente 2
  const svc3 = await serviceService.create({
    clientId: client2.id,
    description: 'Envío Mendoza a CABA - 500kg electrónica',
    serviceDate: '2026-03-01',
    amount: 52000,
  });

  // Crear servicios para cliente 3
  const svc4 = await serviceService.create({
    clientId: client3.id,
    description: 'Envío Tucumán a Rosario - 2000kg alimentos',
    serviceDate: '2026-03-02',
    amount: 67000,
  });
  const svc5 = await serviceService.create({
    clientId: client3.id,
    description: 'Envío Salta a CABA - 300kg textiles',
    serviceDate: '2026-03-03',
    amount: 28500,
  });

  console.log(`\nServicios creados: ${svc1.id}, ${svc2.id}, ${svc3.id}, ${svc4.id}, ${svc5.id}`);

  // Entregar servicios (genera pendientes automáticamente)
  await serviceService.updateStatus(svc1.id, { status: ServiceStatus.DELIVERED });
  await serviceService.updateStatus(svc2.id, { status: ServiceStatus.DELIVERED });
  await serviceService.updateStatus(svc3.id, { status: ServiceStatus.DELIVERED });
  await serviceService.updateStatus(svc4.id, { status: ServiceStatus.DELIVERED });
  // svc5 queda en PENDING (no se factura)

  const pendings = await billingPendingService.findAllPending();
  console.log(`\nPendientes generados: ${pendings.length} (el servicio ${svc5.id} queda sin entregar)`);

  // Ejecutar facturación por lotes
  const batch = await billingService.process(receiptBook.id);
  console.log(`\n=== Facturación ejecutada ===`);
  console.log(`Lote: ${batch.id}`);
  console.log(`Facturas generadas: ${batch.invoiceCount}`);
  console.log(`Monto total: $${batch.totalAmount}`);
  for (const inv of batch.invoices) {
    console.log(`  ${inv.id} | ${inv.invoiceNumber} | Cliente: ${inv.clientId} | $${inv.totalAmount}`);
  }

  // Verificar que no quedan pendientes
  const remaining = await billingPendingService.findAllPending();
  console.log(`\nPendientes restantes: ${remaining.length}`);

  console.log('\n=== Seed completado ===');
  await app.close();
}

seed().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
