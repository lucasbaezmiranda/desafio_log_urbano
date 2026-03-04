# Desafío Log Urbano - Sistema de Facturación por Lotes

Sistema de facturación por lotes para una empresa de logística. Permite registrar clientes, servicios de transporte y generar facturas agrupadas en lotes. Desplegado en AWS con ECS Fargate, RDS, SQS y Lambda.

## Tabla de contenidos

- [Arquitectura](#arquitectura)
- [Levantar el proyecto](#levantar-el-proyecto)
- [Modelo de datos](#1-decisiones-de-modelado)
- [Concurrencia e idempotencia](#2-concurrencia-e-idempotencia)
- [Alcance del challenge](#3-alcance-del-challenge)
- [Sincronización con sistema contable](#4-preparación-de-datos-para-sincronización-con-sistema-contable)
- [Procesamiento asíncrono](#5-procesamiento-asíncrono)
- [Migraciones y seeds](#6-migraciones-y-seeds)
- [Mejoras futuras](#7-mejoras-futuras)
- [Endpoints de la API](#endpoints-de-la-api)

---

## Arquitectura

### Local (Docker Compose)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  PostgreSQL   │
│  React+Nginx │     │   NestJS     │     │     16        │
│  :8080       │     │   :3001      │     │   :5432       │
└──────────────┘     └──────────────┘     └──────────────┘
```

### AWS (Producción)

```
                      Internet
                         │
                     ┌───┴───┐
                     │  ALB  │  (Application Load Balancer, HTTP :80)
                     └───┬───┘
                ┌────────┴────────┐
                │                 │
          ┌─────┴─────┐   ┌──────┴──────┐
          │ Frontend  │   │   Backend   │
          │ ECS Task  │   │  ECS Task   │
          │ (Nginx)   │   │  (NestJS)   │
          └───────────┘   └──────┬──────┘
                                 │
                      ┌──────────┼──────────┐
                      │          │          │
                ┌─────┴───┐ ┌───┴───┐ ┌────┴────┐
                │   RDS   │ │  SQS  │ │   SNS   │
                │ Postgres│ │ Cola  │ │ Emails  │
                └─────────┘ │+ DLQ  │ └─────────┘
                            └───┬───┘
                                │
                          ┌─────┴─────┐
                          │  Lambda   │
                          │  Worker   │
                          └───────────┘
                                │
                           CloudWatch
                       (logs + alarmas + dashboard)
```

**Componentes:**
- **Frontend:** React + Vite, servido con Nginx en ECS Fargate
- **Backend:** NestJS + TypeORM, ECS Fargate, prefijo global `/api`
- **Base de datos:** PostgreSQL 16 en RDS (db.t3.micro)
- **Mensajería:** SQS para facturación async + DLQ (3 reintentos)
- **Notificaciones:** SNS para avisos post-facturación
- **Worker:** Lambda consume SQS y ejecuta facturación
- **Infra:** Terraform (13 archivos en `infra/`)

El diagrama completo de arquitectura AWS se puede generar ejecutando:
```bash
python3 docs/arquitectura_aws.py  # genera docs/arquitectura_aws.png
```

---

## Levantar el proyecto

### Con Docker Compose (local)

```bash
git clone <repo-url>
cd desafio_log_urbano
cp .env.example .env
docker compose up
```

- Frontend: http://localhost:8080
- Backend: http://localhost:3001
- Health: http://localhost:3001/health
- **Login:** usuario `test` / contraseña `test`

### Seed de datos de prueba

```bash
cd backend
npm install --legacy-peer-deps
POSTGRES_HOST=localhost npm run seed
```

El seed carga un flujo completo: 3 clientes, 1 talonario, 5 servicios (4 entregados), ejecuta facturación y genera 1 lote con 3 facturas. Ver sección [Migraciones y Seeds](#6-migraciones-y-seeds) para más detalle.

### Tests

```bash
cd backend
npm test
```

12 tests unitarios: BillingService (5), ClientService (4), ServiceService (3).

### Desplegar en AWS

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars  # configurar db_password
terraform init
terraform apply
```

Luego push de imágenes Docker a ECR:
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker build -t <account-id>.dkr.ecr.us-east-1.amazonaws.com/desafio-log-urbano-backend:latest ./backend
docker build -t <account-id>.dkr.ecr.us-east-1.amazonaws.com/desafio-log-urbano-frontend:latest ./frontend
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/desafio-log-urbano-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/desafio-log-urbano-frontend:latest
aws ecs update-service --cluster desafio-log-urbano-cluster --service desafio-log-urbano-backend --force-new-deployment
aws ecs update-service --cluster desafio-log-urbano-cluster --service desafio-log-urbano-frontend --force-new-deployment
```

**URL de producción:** http://billing.lukebm.com (usuario `test` / contraseña `test`)

---

## 1. Decisiones de Modelado

### Relación entre entidades

```
Client (CLI-XXXXXXX)
│   businessName, taxId, taxCondition, email
│
├── Service (SRV-XXXXXXX)
│       description, amount, serviceDate
│       status: PENDING → IN_TRANSIT → DELIVERED → [facturado]
│       │
│       └── BillingPending (PEN-XXXXXXX)
│               Se crea automáticamente al marcar servicio como DELIVERED
│               status: PENDING → INVOICED
│               Vincula servicio con factura (invoiceId)
│
ReceiptBook (TAL-XXXXXXX)
│   pointOfSale, description, nextNumber, isActive
│
└── InvoiceBatch (LOT-XXXXXXX)
        issueDate, status (PROCESSED|ERROR), totalAmount, invoiceCount
        │
        └── Invoice (FAC-XXXXXXX)
                invoiceNumber (0001-00000001), totalAmount, cae, caeExpirationDate
                clientId → Client
                │
                └── BillingPending[] (items: los servicios incluidos en esta factura)
```

Cada entidad usa un **ID custom con formato `PREFIX-XXXXXXX`** (ej: `CLI-0000001`, `FAC-0000003`), generado con secuencias de PostgreSQL para garantizar atomicidad y unicidad. Los IDs son legibles para el negocio, lo cual facilita la comunicación con el equipo contable y la trazabilidad de documentos.

### Campos obligatorios y por qué

| Entidad | Campo | Razón |
|---------|-------|-------|
| Client | businessName | Identificación legal en la factura |
| Client | taxId (CUIT) | Requerido por AFIP para la facturación |
| Client | taxCondition | Define el tipo de factura (A, B, C) |
| Service | clientId | Todo servicio pertenece a un cliente |
| Service | amount | Necesario para calcular el total de la factura |
| Invoice | invoiceNumber | Numeración legal correlativa por punto de venta |
| Invoice | batchId | Las facturas siempre se generan en un lote |
| ReceiptBook | pointOfSale | Requerido por AFIP, identifica el punto de emisión |

### Separación de dominios: logística vs facturación

**El dominio de logística** (Service) se limita a: cliente, descripción, monto, fecha y estado del transporte (`PENDING → IN_TRANSIT → DELIVERED → CANCELLED`). Service **no** tiene campos de facturación.

**El dominio de facturación** vive en un módulo separado (`billing/`). La entidad **BillingPending** actúa como **puente entre ambos dominios**: se crea automáticamente cuando un servicio pasa a `DELIVERED`, marcando que ese servicio está pendiente de facturar.

Esta decisión tiene tres ventajas:
1. **Service no conoce el concepto de "factura"** — solo sabe de estados logísticos
2. **BillingPending desacopla la lógica** — si mañana se cambia el criterio de facturación (ej: facturar al entregar + firmar), solo se modifica cuándo se crea el PEN, no el servicio
3. **Un servicio puede existir sin ser facturado** (ej: cancelado, en tránsito) sin inconsistencias

---

## 2. Concurrencia e Idempotencia

### ¿Qué pasa si dos usuarios facturan al mismo tiempo?

El proceso de facturación se ejecuta dentro de una **transacción PostgreSQL** (`dataSource.transaction()`). Esto garantiza:

- **Atomicidad**: Si falla cualquier parte, se revierte todo (no quedan facturas huérfanas ni pendientes en estado inconsistente)
- **Aislamiento**: PostgreSQL usa `READ COMMITTED` por defecto, lo que previene lecturas sucias

Si dos usuarios ejecutan facturación simultáneamente:
1. El primero entra a la transacción, lee los pendientes con status `PENDING`, y los marca como `INVOICED`
2. El segundo entra, lee los pendientes — pero los que ya fueron tomados por el primero ya están en `INVOICED`
3. Si no quedan pendientes, el segundo recibe error `"No pending services to invoice"`

### Idempotencia

La idempotencia se maneja a nivel de estado:
- Un `BillingPending` pasa de `PENDING` a `INVOICED` una sola vez
- La relación `BillingPending.serviceId` tiene constraint `UNIQUE` — un servicio solo puede tener un registro pendiente
- Si se reintenta la facturación (ej: tras un fallo de red), los pendientes ya facturados no se vuelven a procesar

En el flujo async (SQS), si Lambda falla y SQS reintenta:
- Los pendientes ya facturados tienen status `INVOICED`, así que no se duplican facturas
- Después de 3 reintentos fallidos, el mensaje va a la **DLQ** (Dead Letter Queue) para revisión manual

### Estrategias implementadas

| Estrategia | Implementación |
|------------|----------------|
| Transacción atómica | `dataSource.transaction()` en `BillingService.process()` |
| Unicidad de pendientes | Constraint `UNIQUE` en `billing_pending.service_id` |
| Estado como guard | Solo se facturan pendientes con `status = PENDING` |
| Reintentos controlados | SQS con `maxReceiveCount: 3` antes de enviar a DLQ |
| Validación previa | Se valida talonario activo y existencia de pendientes antes de procesar |

---

## 3. Alcance del challenge

### Features priorizadas

1. **CRUD completo de entidades** (clientes, servicios, talonarios) — base necesaria para cualquier flujo
2. **Facturación por lotes transaccional** — el core del negocio, con agrupación por cliente y numeración secuencial
3. **Autenticación mock JWT** — login con `test/test`, guard global con decorador `@Public()`, token en header
4. **Frontend funcional** — login screen, dashboard React con 4 pestañas, logout
5. **Procesamiento async via SQS** — demuestra manejo de colas, reintentos y desacoplamiento
6. **Infraestructura AWS con Terraform** — ECS Fargate, RDS, ALB, SQS, SNS, Lambda, CloudWatch
7. **Tests unitarios** — cobertura de los servicios críticos (billing, clients, services)
8. **Observabilidad** — CloudWatch con log groups, alarmas (DLQ, CPU, conexiones RDS) y dashboard

### ¿Por qué estas y no otras?

- La facturación por lotes es el **core del desafío** — se le dio la mayor atención (transacciones, idempotencia, async)
- La infra AWS demuestra competencia en **cloud y DevOps**
- Se priorizó un **flujo end-to-end funcional** sobre features parcialmente implementadas
- Se dejaron fuera integraciones externas (AFIP, pasarelas de pago) porque requieren credenciales reales y no agregan valor técnico al desafío

---

## 4. Preparación de Datos para Sincronización con Sistema Contable

### Formato de datos

El endpoint `GET /api/billing/batches/:id` retorna toda la información necesaria para sincronizar con un sistema contable:

```json
{
  "id": "LOT-0000001",
  "issueDate": "2026-03-04",
  "status": "PROCESSED",
  "totalAmount": 202000,
  "invoiceCount": 3,
  "receiptBook": {
    "id": "TAL-0000001",
    "pointOfSale": 2,
    "description": "Punto de venta sede central"
  },
  "invoices": [
    {
      "id": "FAC-0000001",
      "invoiceNumber": "0002-00000001",
      "issueDate": "2026-03-04",
      "totalAmount": 83000,
      "cae": null,
      "caeExpirationDate": null,
      "client": {
        "id": "CLI-0000001",
        "businessName": "Transportes del Sur S.A.",
        "taxId": "30-71234567-9",
        "taxCondition": "RESPONSABLE_INSCRIPTO",
        "email": "admin@transportesdelsur.com.ar"
      },
      "items": [
        {
          "id": "PEN-0000001",
          "serviceId": "SRV-0000001",
          "service": {
            "id": "SRV-0000001",
            "description": "Envío CABA a Rosario - 1200kg maquinaria",
            "amount": 45000
          }
        },
        {
          "id": "PEN-0000002",
          "serviceId": "SRV-0000002",
          "service": {
            "id": "SRV-0000002",
            "description": "Envío CABA a Córdoba - 800kg insumos",
            "amount": 38000
          }
        }
      ]
    }
  ]
}
```

### ¿Por qué estos campos?

| Campo | Razón |
|-------|-------|
| `invoiceNumber` (0002-00000001) | Formato AFIP: punto de venta (4 dígitos) + número correlativo (8 dígitos). Es el identificador legal de la factura |
| `client.taxId` (CUIT) | Requerido por AFIP para identificar al receptor |
| `client.taxCondition` | Define el tipo de comprobante (Factura A para RI, B para CF/Monotributo/Exento) |
| `cae` + `caeExpirationDate` | Campos preparados para la respuesta de AFIP al autorizar el comprobante electrónico |
| `issueDate` | Fecha de emisión, requerida legalmente |
| `items[].service.description` | Detalle de los conceptos facturados |
| `items[].service.amount` | Monto individual de cada concepto |
| `receiptBook.pointOfSale` | Identifica el punto de venta emisor |

### Flujo de sincronización propuesto

1. Backend genera el lote con facturas (sin CAE)
2. Un servicio de integración toma el lote y envía cada factura a la API de AFIP (WSFE)
3. AFIP responde con CAE y fecha de vencimiento
4. Se actualiza la factura con `cae` y `caeExpirationDate`
5. El lote queda completo y listo para el libro IVA

Los campos `cae` y `caeExpirationDate` están modelados como `nullable` precisamente porque se completan después de la autorización de AFIP, no al momento de crear la factura.

---

## 5. Procesamiento Asíncrono

### Tecnología elegida: Amazon SQS

**¿Por qué SQS?**
- **Integración nativa con AWS** — el stack ya usa ECS, RDS y Lambda
- **Garantía de entrega** — SQS garantiza at-least-once delivery
- **Dead Letter Queue** — mensajes fallidos van a una cola separada para análisis
- **Serverless** — no hay que mantener un broker (vs RabbitMQ, Redis)
- **Costo** — virtualmente $0 para el volumen de este proyecto

Alternativas consideradas:
- **RabbitMQ**: Más features (routing, prioridad) pero requiere mantener infraestructura
- **Redis Pub/Sub**: No persiste mensajes, no tiene reintentos nativos
- **EventBridge**: Más orientado a eventos, overengineering para este caso

### Flujo async de facturación

```
Frontend                    Backend                     SQS                    Lambda                  Backend
   │                          │                          │                       │                       │
   ├─ POST /billing/process ─▶│                          │                       │                       │
   │                          ├─ Valida pendientes ──────│                       │                       │
   │                          ├─ SendMessage ───────────▶│                       │                       │
   │◀─── 202 Accepted ───────┤                          │                       │                       │
   │                          │                          ├── trigger ───────────▶│                       │
   │                          │                          │                       ├─ POST /process-sync ─▶│
   │                          │                          │                       │                       ├─ Factura en transacción
   │                          │                          │                       │◀── batch result ──────┤
   │                          │                          │                       ├─ SNS notify ──────────│
   ├─ GET /billing/batches ──▶│                          │                       │                       │
   │◀──── [nuevo lote] ──────┤                          │                       │                       │
```

### Manejo de errores y reintentos

| Escenario | Comportamiento |
|-----------|---------------|
| Lambda falla (excepción) | SQS reintenta automáticamente |
| Backend retorna error 5xx | Lambda propaga el error, SQS reintenta |
| 3 reintentos fallidos | Mensaje va a DLQ (`desafio-billing-dlq`) |
| Mensaje en DLQ | Alarma CloudWatch se dispara, notifica via SNS |
| Pendientes ya facturados (retry tras éxito parcial) | El guard `status = PENDING` previene duplicación |

**Configuración SQS:**
- Visibility timeout: 60 segundos (tiempo para que Lambda procese)
- Max receive count: 3 (reintentos antes de DLQ)
- DLQ retención: 14 días (tiempo para investigar fallos)

### Fallback sincrónico

Si `SQS_QUEUE_URL` no está configurado (desarrollo local), el backend ejecuta la facturación sincrónicamente en el mismo request. Esto permite desarrollar y testear sin necesidad de infraestructura AWS.

---

## 6. Migraciones y Seeds

### Migraciones

En desarrollo, TypeORM con `synchronize: true` crea y actualiza las tablas automáticamente basándose en las entidades. Esto es conveniente para iteración rápida.

En producción (AWS), `synchronize: true` también está habilitado para el primer deploy que crea el schema. Para un entorno productivo real, se recomendaría:

1. Generar migraciones con `typeorm migration:generate`
2. Ejecutarlas como servicio separado en Docker Compose antes del backend
3. Deshabilitar `synchronize` en producción

**Estructura propuesta de migraciones:**

```
backend/src/migrations/
├── 001_create_clients_table.ts          # Tabla clients con enum tax_condition
├── 002_create_services_table.ts         # Tabla services con enum service_status, FK a clients
├── 003_create_receipt_books_table.ts    # Tabla receipt_books con punto de venta
├── 004_create_invoice_batches_table.ts  # Tabla invoice_batches con enum batch_status, FK a receipt_books
├── 005_create_invoices_table.ts         # Tabla invoices con FK a batches y clients
├── 006_create_billing_pending_table.ts  # Tabla billing_pending con FK a services e invoices
└── 007_create_id_sequences.ts           # Secuencias PostgreSQL para IDs custom
```

Cada migración debería documentar:
- **Qué cambio realiza**: Creación de tabla, índices, constraints
- **Por qué**: Justificación de negocio (ej: "tabla de pendientes para desacoplar logística de facturación")
- **Impacto en datos existentes**: Si es la primera migración, no hay impacto. En migraciones posteriores, documentar si requiere backfill

### Seeds

**Ejecutar:**
```bash
cd backend
POSTGRES_HOST=localhost npm run seed
```

**Datos que carga el seed:**

| Entidad | Cantidad | Detalle |
|---------|----------|---------|
| Clientes | 3 | Transportes del Sur (RI), Logística Rápida (Monotributo), Distribuidora Norte (RI) |
| Talonarios | 1 | PV 2 - Sede central |
| Servicios | 5 | 2 para cliente 1, 1 para cliente 2, 2 para cliente 3 |
| Entregas | 4 | Se entregan 4 servicios (1 queda en PENDING para demostrar el filtro) |
| Facturación | 1 lote | 3 facturas (una por cliente), monto total $202.000 |

**Flujos que se pueden verificar con el seed:**
1. Creación de clientes con distintas condiciones fiscales
2. Creación de servicios asociados a clientes
3. Transición de estados de servicio (PENDING → DELIVERED)
4. Generación automática de pendientes de facturación
5. Facturación por lotes con agrupación por cliente
6. Numeración secuencial de facturas por punto de venta
7. Servicio no entregado que queda fuera de la facturación

---

## 7. Mejoras Futuras

### Técnicas

| Mejora | Descripción | Impacto |
|--------|-------------|---------|
| **Migraciones TypeORM** | Reemplazar `synchronize: true` por migraciones versionadas con servicio separado en Docker Compose | Seguridad en producción, rollback de schema |
| **HTTPS + dominio** | Certificado SSL con ACM + dominio en Route 53 | Seguridad, accesibilidad desde móviles |
| **CI/CD con GitHub Actions** | Build, test, push a ECR y deploy automático en cada push | Velocidad de iteración |
| **RDS Proxy** | Connection pooling para manejar cold starts de Lambda | Estabilidad con muchas conexiones concurrentes |
| **Cache con Redis/ElastiCache** | Cache de consultas frecuentes (clientes, talonarios) | Performance |
| **Paginación** | Paginar listados de servicios, facturas y lotes | Escalabilidad con volumen de datos |
| **Rate limiting** | Limitar requests por IP en el ALB o backend | Protección contra abuso |
| **Optimistic locking** | Agregar campo `version` a entidades críticas | Prevención de conflictos en actualizaciones concurrentes |

### De negocio

| Mejora | Descripción | Impacto |
|--------|-------------|---------|
| **Integración AFIP (WSFE)** | Autorizar comprobantes electrónicos y obtener CAE | Cumplimiento fiscal |
| **Notas de crédito** | Anular o ajustar facturas emitidas | Completar el ciclo contable |
| **Reportes** | Libro IVA Ventas, resumen por período, por cliente | Contabilidad |
| **Facturación parcial** | Seleccionar qué pendientes facturar (no todos) | Flexibilidad operativa |
| **Multi-moneda** | Soporte para USD y otras monedas | Operaciones internacionales |
| **Auditoría** | Log de quién facturó, cuándo y qué modificó | Trazabilidad |
| **Roles y permisos** | Extender auth actual con roles (admin, operador, consulta) y usuarios reales en DB | Seguridad |
| **Notificaciones al cliente** | Email automático al cliente cuando se genera su factura | UX |

### Problemas técnicos anticipados

- **Volumen de datos**: Con miles de servicios, el `findAll` de pendientes sin paginación va a ser lento. Solución: paginación + índices en `status`
- **Secuencias de IDs**: Las secuencias PostgreSQL no se resetean al borrar datos. En un sistema real, esto es correcto (los números de factura no se reutilizan por ley)
- **Cold starts de Lambda**: La primera invocación tarda ~1s extra. Con RDS Proxy y provisioned concurrency se mitiga
- **Consistencia eventual**: En el flujo async, hay una ventana entre el POST y el procesamiento real donde el frontend muestra "Procesando". Si Lambda falla y va a DLQ, el usuario no recibe feedback directo — necesitaría un mecanismo de notificación (WebSocket o polling con status del job)

---

## Endpoints de la API

Todos los endpoints (excepto `/health`) usan el prefijo `/api`.

### Health
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del servicio (público) |

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login con `{"username":"test","password":"test"}` → `{ "access_token": "..." }` |

Todos los demás endpoints requieren header `Authorization: Bearer <token>`. Si el token es inválido o expiró, se retorna `401 Unauthorized`.

### Clientes
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/clients` | Crear cliente |
| GET | `/api/clients` | Listar clientes |
| DELETE | `/api/clients/:id` | Eliminar cliente |

### Servicios
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/services` | Crear servicio de transporte |
| GET | `/api/services` | Listar servicios |
| PATCH | `/api/services/:id/status` | Cambiar estado (PENDING → IN_TRANSIT → DELIVERED) |

### Talonarios
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/receipt-books` | Crear talonario |
| GET | `/api/receipt-books` | Listar talonarios |
| PUT | `/api/receipt-books/:id` | Actualizar talonario |
| DELETE | `/api/receipt-books/:id` | Eliminar talonario |

### Facturación
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/billing/pending` | Ver servicios pendientes de facturar |
| POST | `/api/billing/process` | Facturar lote (async via SQS o sincrónico) |
| POST | `/api/billing/process-sync` | Facturar lote sincrónicamente (usado por Lambda) |
| GET | `/api/billing/batches` | Listar lotes de facturación |
| GET | `/api/billing/batches/:id` | Detalle de un lote con facturas y servicios |

---

## Frontend

Pantalla de login (usuario `test` / contraseña `test`) y dashboard con 4 tabs:

- **Clientes** — Crear y listar clientes con razón social, CUIT, condición fiscal y email
- **Servicios** — Crear servicios, cambiar estado (Pendiente → En tránsito → Entregado)
- **Talonarios** — Crear y listar puntos de venta
- **Facturación** — Ver pendientes, ejecutar facturación por lotes, ver lotes con detalle de facturas y servicios incluidos

El token JWT se guarda en localStorage. Si expira o es inválido, se redirige automáticamente al login. Botón de "Cerrar sesión" en el header.

---

## Estructura del proyecto

```
desafio_log_urbano/
├── backend/
│   ├── src/
│   │   ├── main.ts                    # Bootstrap, prefijo /api
│   │   ├── app.module.ts              # TypeORM config, SSL en producción
│   │   ├── health.controller.ts       # GET /health
│   │   ├── common/                    # Enums, IDs, secuencias
│   │   └── modules/
│   │       ├── auth/                  # JWT auth mock (login, guard global, @Public)
│   │       ├── client/                # CRUD clientes
│   │       ├── service/               # CRUD servicios + estados
│   │       ├── receipt-book/          # CRUD talonarios
│   │       └── billing/               # Facturación (async + sync)
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/                # LoginScreen, BillingTab, ClientsTab, ServicesTab, etc.
│   │   ├── api.ts                     # Cliente HTTP (auth header + manejo 401)
│   │   └── App.tsx                    # Login/dashboard condicional + logout
│   ├── Dockerfile
│   └── nginx.conf
├── infra/                             # Terraform (13 archivos)
│   ├── main.tf, variables.tf, outputs.tf
│   ├── vpc.tf, alb.tf, ecs.tf, ecr.tf
│   ├── rds.tf, sqs.tf, sns.tf
│   ├── lambda.tf, lambda/index.mjs
│   ├── iam.tf, cloudwatch.tf
│   └── terraform.tfvars.example
├── docs/
│   ├── backend.md                     # Documentación técnica del backend
│   └── arquitectura_aws.py           # Generador de diagrama AWS
├── docker-compose.yml
└── .env.example
```
