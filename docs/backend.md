# Backend - Documentación Técnica

## Stack
- **NestJS 10** con TypeORM 0.3
- **PostgreSQL 16** (RDS en AWS, Docker local)
- **AWS SDK** (SQS, SNS) para facturación async

## Estructura

```
backend/src/
├── main.ts                          # Bootstrap, global prefix /api
├── app.module.ts                    # Root module, TypeORM config, SSL
├── health.controller.ts             # GET /health
├── common/
│   ├── enums.ts                     # TaxCondition, ServiceStatus, BillingPendingStatus, InvoiceBatchStatus
│   ├── id-generator.ts              # IDs con formato PREFIX-XXXXXXX (secuencias PostgreSQL)
│   └── sequences.initializer.ts     # Crea secuencias al inicio
└── modules/
    ├── client/                      # CRUD de clientes
    ├── service/                     # CRUD de servicios de transporte
    ├── receipt-book/                # CRUD de talonarios (puntos de venta)
    └── billing/                     # Facturación por lotes
```

## Entidades y Relaciones

```
Client (CLI-XXXXXXX)
│   businessName, taxId, taxCondition, email
│
├── Service (SRV-XXXXXXX)
│       description, amount, status (PENDING → IN_TRANSIT → DELIVERED)
│       │
│       └── BillingPending (PEN-XXXXXXX)  ← se crea automáticamente al pasar a DELIVERED
│               status (PENDING → INVOICED), invoiceId
│
ReceiptBook (TAL-XXXXXXX)
│   pointOfSale, description, nextNumber, isActive
│
└── InvoiceBatch (LOT-XXXXXXX)
        issueDate, status, totalAmount, invoiceCount
        │
        └── Invoice (FAC-XXXXXXX)
                invoiceNumber (0001-00000001), totalAmount, clientId
                │
                └── BillingPending[] (items facturados)
```

## API Endpoints

### Health
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check (sin prefijo /api) |

### Clientes
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/clients` | Listar clientes |
| POST | `/api/clients` | Crear cliente |
| DELETE | `/api/clients/:id` | Eliminar cliente |

**Body POST:**
```json
{
  "businessName": "Empresa SA",
  "taxId": "30-71234567-8",
  "taxCondition": "RESPONSABLE_INSCRIPTO",
  "email": "empresa@mail.com"
}
```

`taxCondition` acepta: `RESPONSABLE_INSCRIPTO`, `MONOTRIBUTO`, `EXENTO`, `CONSUMIDOR_FINAL`

### Servicios
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/services` | Listar servicios |
| POST | `/api/services` | Crear servicio |
| PATCH | `/api/services/:id/status` | Cambiar estado |

**Body POST:**
```json
{
  "clientId": "CLI-0000001",
  "description": "Envío CABA a Córdoba",
  "amount": 15000
}
```

**Flujo de estados:** `PENDING` → `IN_TRANSIT` → `DELIVERED`

Al pasar a `DELIVERED`, se crea automáticamente un registro `BillingPending` (pendiente de facturar).

### Talonarios
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/receipt-books` | Listar talonarios |
| POST | `/api/receipt-books` | Crear talonario |
| PUT | `/api/receipt-books/:id` | Actualizar |
| DELETE | `/api/receipt-books/:id` | Eliminar |

**Body POST:**
```json
{
  "pointOfSale": 1,
  "description": "Punto de venta central"
}
```

### Facturación
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/billing/pending` | Ver pendientes de facturar |
| POST | `/api/billing/process` | Facturar lote (async via SQS) |
| POST | `/api/billing/process-sync` | Facturar lote (sincrónico, usado por Lambda) |
| GET | `/api/billing/batches` | Listar lotes |
| GET | `/api/billing/batches/:id` | Detalle de lote con facturas y servicios |

**Body POST process:**
```json
{
  "receiptBookId": "TAL-0000001"
}
```

## Flujo de Facturación

### Sincrónico (desarrollo local, sin SQS)
1. POST `/api/billing/process` con `receiptBookId`
2. Valida talonario activo y que haya pendientes
3. Agrupa pendientes por cliente
4. En una transacción PostgreSQL:
   - Crea `InvoiceBatch`
   - Por cada cliente: crea `Invoice` con número secuencial
   - Marca `BillingPending` como `INVOICED`
   - Actualiza totales del lote
5. Retorna `{ status: "completed", batch: {...} }`

### Asincrónico (AWS con SQS)
1. POST `/api/billing/process` → valida y envía mensaje a SQS → retorna `{ status: "queued" }`
2. SQS entrega mensaje a Lambda Worker
3. Lambda llama a POST `/api/billing/process-sync` via ALB
4. Backend ejecuta la facturación (mismo flujo sincrónico)
5. Lambda notifica via SNS
6. Si falla 3 veces → mensaje va a DLQ → alarma CloudWatch

## IDs Personalizados

Formato: `PREFIX-XXXXXXX` (11 caracteres total)

| Prefijo | Entidad |
|---------|---------|
| CLI | Client |
| SRV | Service |
| PEN | BillingPending |
| TAL | ReceiptBook |
| LOT | InvoiceBatch |
| FAC | Invoice |

Generados con secuencias PostgreSQL (`generateCustomId()`), garantizando unicidad atómica.

## Variables de Entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `POSTGRES_HOST` | localhost | Host de PostgreSQL |
| `POSTGRES_PORT` | 5432 | Puerto de PostgreSQL |
| `POSTGRES_USER` | logurbano | Usuario de BD |
| `POSTGRES_PASSWORD` | logurbano_dev | Contraseña de BD |
| `POSTGRES_DB` | logurbano | Nombre de la BD |
| `PORT` | 3000 | Puerto del backend |
| `NODE_ENV` | development | Entorno (production habilita SSL) |
| `SQS_QUEUE_URL` | - | URL de cola SQS (si vacío, usa modo sincrónico) |
| `SNS_TOPIC_ARN` | - | ARN del topic SNS |
| `AWS_REGION` | us-east-1 | Región AWS |

## Tests

```bash
npm test          # Ejecutar tests unitarios
npm run test:watch # Watch mode
```

Tests existentes:
- `billing.service.spec.ts` - Facturación por lotes (5 tests)
- `client.service.spec.ts` - CRUD de clientes (4 tests)
- `service.service.spec.ts` - CRUD de servicios (3 tests)
