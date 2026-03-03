# Resumen del Backend

## Stack Tecnológico
- **Framework**: NestJS 10 + TypeScript
- **ORM**: TypeORM 0.3
- **Base de datos**: PostgreSQL 16
- **Validación**: class-validator + class-transformer
- **Contenedores**: Docker con build multistage
- **Tests**: Jest + ts-jest + @nestjs/testing

## Estructura de Carpetas

```
backend/
├── src/
│   ├── common/
│   │   ├── enums.ts                    # TaxCondition, ServiceStatus, BillingPendingStatus, InvoiceBatchStatus
│   │   ├── id-generator.ts             # Generador de IDs custom (XXX-0000001) con secuencias PostgreSQL
│   │   └── sequences.initializer.ts    # Crea las secuencias al iniciar la app
│   ├── modules/
│   │   ├── client/
│   │   │   ├── client.entity.ts
│   │   │   ├── client.module.ts
│   │   │   ├── client.service.ts
│   │   │   ├── client.controller.ts    # CRUD completo
│   │   │   ├── client.service.spec.ts  # 4 tests
│   │   │   └── dto/
│   │   │       ├── create-client.dto.ts
│   │   │       └── update-client.dto.ts
│   │   ├── service/
│   │   │   ├── service.entity.ts
│   │   │   ├── service.module.ts
│   │   │   ├── service.service.ts      # Al pasar a DELIVERED genera billing_pending automáticamente
│   │   │   ├── service.controller.ts   # CRUD + PATCH status
│   │   │   ├── service.service.spec.ts # 3 tests
│   │   │   └── dto/
│   │   │       ├── create-service.dto.ts
│   │   │       └── update-service-status.dto.ts
│   │   ├── billing/
│   │   │   ├── billing-pending.entity.ts
│   │   │   ├── invoice-batch.entity.ts
│   │   │   ├── invoice.entity.ts
│   │   │   ├── billing.module.ts
│   │   │   ├── billing-pending.service.ts  # Crea pendientes desde servicios entregados
│   │   │   ├── billing.service.ts          # Proceso de facturación por lotes
│   │   │   ├── billing.controller.ts       # Endpoints de facturación
│   │   │   ├── billing.service.spec.ts     # 5 tests
│   │   │   └── dto/
│   │   │       └── process-billing.dto.ts
│   │   └── receipt-book/
│   │       ├── receipt-book.entity.ts
│   │       ├── receipt-book.module.ts
│   │       ├── receipt-book.service.ts
│   │       ├── receipt-book.controller.ts  # CRUD completo
│   │       └── dto/
│   │           ├── create-receipt-book.dto.ts
│   │           └── update-receipt-book.dto.ts
│   ├── app.module.ts
│   ├── main.ts
│   ├── health.controller.ts
│   └── seed.ts                         # Script de datos de prueba
├── Dockerfile
├── package.json
├── tsconfig.json
├── nest-cli.json
└── jest.config.js
```

## Entidades y Modelo de Datos

| Entidad | Prefijo ID | Tabla | Descripción |
|---------|-----------|-------|-------------|
| Client | CLI | clients | Clientes con razón social, CUIT y condición fiscal |
| Service | SRV | services | Servicios de transporte con monto y estado |
| BillingPending | PEN | billing_pending | Marca un servicio como pendiente de facturar |
| ReceiptBook | TAL | receipt_books | Talonario / punto de venta con numeración correlativa |
| InvoiceBatch | LOT | invoice_batches | Lote de facturas generadas en un proceso |
| Invoice | FAC | invoices | Factura individual con número, monto y CAE |

### Enums
- **TaxCondition**: RESPONSABLE_INSCRIPTO, MONOTRIBUTO, EXENTO, CONSUMIDOR_FINAL
- **ServiceStatus**: PENDING, IN_TRANSIT, DELIVERED, CANCELLED
- **BillingPendingStatus**: PENDING, INVOICED
- **InvoiceBatchStatus**: PROCESSED, ERROR

## Endpoints

### Health
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /health | Estado del servicio |

### Clientes
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /clients | Crear cliente |
| GET | /clients | Listar clientes |
| GET | /clients/:id | Obtener cliente |
| PUT | /clients/:id | Actualizar cliente |
| DELETE | /clients/:id | Eliminar cliente |

### Servicios
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /services | Crear servicio |
| GET | /services | Listar servicios (acepta ?clientId=) |
| GET | /services/:id | Obtener servicio con datos del cliente |
| PATCH | /services/:id/status | Cambiar estado |

### Talonarios
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /receipt-books | Crear talonario |
| GET | /receipt-books | Listar talonarios |
| GET | /receipt-books/:id | Obtener talonario |
| PUT | /receipt-books/:id | Actualizar talonario |
| DELETE | /receipt-books/:id | Eliminar talonario |

### Facturación
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /billing/pending | Ver pendientes de facturar |
| POST | /billing/process | Ejecutar facturación por lotes |
| GET | /billing/batches | Listar lotes |
| GET | /billing/batches/:id | Detalle de un lote con facturas |

## Flujo de Facturación

```
1. POST /clients                          → CLI-0000001
2. POST /receipt-books                    → TAL-0000001
3. POST /services                         → SRV-0000001 (PENDING)
4. PATCH /services/SRV-0000001/status     → DELIVERED
   └── Se crea automáticamente            → PEN-0000001 (PENDING)
5. POST /billing/process                  → LOT-0000001 (PROCESSED)
   ├── Agrupa pendientes por cliente
   ├── Genera una factura por cliente     → FAC-0000001
   ├── Marca pendientes como INVOICED
   └── Avanza numeración del talonario
```

## IDs Custom

Formato: `PREFIX-0000001` (ejemplo: `CLI-0000001`, `SRV-0000042`)

- Generados con secuencias de PostgreSQL (atómicos, sin colisiones)
- 6 secuencias independientes: seq_client, seq_service, seq_billing_pending, seq_receipt_book, seq_invoice_batch, seq_invoice
- Se inicializan automáticamente al arrancar la app (SequencesInitializer)

## Tests

12 tests unitarios en 3 suites, ejecutar con `npm test`:

- **ClientService** (4 tests): crear con ID custom, listar, not found, actualizar
- **ServiceService** (3 tests): crear con ID, generar pendiente al entregar, no generar en otros estados
- **BillingService** (5 tests): talonario no encontrado, talonario inactivo, sin pendientes, agrupación por cliente, marcado como facturado

## Seed

Script de datos de prueba, ejecutar con `npm run seed`:

- Crea 3 clientes, 1 talonario, 5 servicios
- Entrega 4 servicios (genera 4 pendientes), 1 queda sin entregar
- Ejecuta facturación → 1 lote con 3 facturas (agrupadas por cliente)

## Comandos

```bash
# Levantar con Docker
docker compose up

# Seed (requiere PostgreSQL corriendo)
cd backend && POSTGRES_HOST=localhost npm run seed

# Tests
cd backend && npm test

# Build
cd backend && npm run build
```
