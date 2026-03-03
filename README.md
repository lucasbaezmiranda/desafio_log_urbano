# Desafío Log Urbano - Sistema de Facturación por Lotes

Sistema de facturación por lotes para una empresa de logística. Permite registrar clientes, servicios de transporte y generar facturas agrupadas en lotes a través de una interfaz web.

## Arquitectura

Monorepo con tres componentes dockerizados:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│  PostgreSQL   │
│  React+Nginx │     │   NestJS     │     │     16        │
│  :8080       │     │   :3001      │     │   :5432       │
└──────────────┘     └──────────────┘     └──────────────┘
```

- **frontend/** - Dashboard React + Vite, servido con Nginx como proxy reverso
- **backend/** - API REST con NestJS + TypeORM + PostgreSQL
- **infra/** - Infraestructura con Terraform (en desarrollo)

## Modelo de Datos

```
Client (CLI-0000001)
  └── Service (SRV-0000001)              // Servicio de transporte
        └── BillingPending (PEN-0000001) // Marca como pendiente de facturar

ReceiptBook (TAL-0000001)                // Talonario / punto de venta
  └── InvoiceBatch (LOT-0000001)         // Lote de facturas
        └── Invoice (FAC-0000001)        // Factura individual
              └── BillingPending         // Vincula factura con servicio
```

Cada entidad usa un ID custom con formato `XXX-0000001`, generado con secuencias de PostgreSQL para garantizar atomicidad.

## Flujo de Facturación

1. Se registran **clientes** con su condición fiscal (RI, Monotributo, Exento, CF)
2. Se cargan **servicios** de transporte asociados a un cliente
3. Los servicios entregados generan automáticamente un registro en **billing_pending**
4. Se selecciona un **talonario** activo y se ejecuta el proceso de facturación por lotes
5. El sistema agrupa los pendientes por cliente, genera las **facturas** y las agrupa en un **lote**
6. Cada factura puede incluir CAE y fecha de vencimiento (integración AFIP)

Todo el proceso de facturación se ejecuta dentro de una **transacción PostgreSQL** para garantizar consistencia.

## Decisiones Técnicas

- **IDs custom con secuencias PostgreSQL**: Legibles para el negocio y atómicos a nivel de base de datos
- **TypeORM con synchronize en dev**: Las tablas se crean automáticamente. En producción se usarían migraciones
- **Enums como tipos PostgreSQL**: Validación a nivel de base de datos, no solo en la app
- **ValidationPipe global**: Validación automática de DTOs con class-validator
- **Docker multistage**: Imágenes de producción livianas sin dependencias de desarrollo
- **Nginx como proxy reverso**: El frontend sirve archivos estáticos y redirige `/api` al backend
- **Transacción en facturación**: El lote, facturas y actualización de pendientes se ejecutan atómicamente

## Levantar el Proyecto

```bash
# Clonar y entrar al directorio
git clone <repo-url>
cd desafio_log_urbano

# Copiar variables de entorno
cp .env.example .env

# Levantar con Docker (3 servicios: postgres, backend, frontend)
docker compose up

# Frontend:  http://localhost:8080
# Backend:   http://localhost:3001
# Health:    http://localhost:3001/health
```

### Seed de datos de prueba

```bash
cd backend
POSTGRES_HOST=localhost npm run seed
```

Carga 3 clientes, 1 talonario, 5 servicios, entrega 4 y ejecuta facturación generando 1 lote con 3 facturas.

### Tests

```bash
cd backend
npm test
```

12 tests unitarios: ClientService (4), ServiceService (3), BillingService (5).

## Frontend

Dashboard con 4 tabs:

- **Clientes** - Crear, listar y eliminar clientes
- **Servicios** - Crear servicios, cambiar estado (Pendiente → En tránsito → Entregado / Cancelado)
- **Talonarios** - Crear y listar puntos de venta
- **Facturación** - Ver pendientes, ejecutar facturación por lotes, ver lotes con detalle de facturas

## Endpoints de la API

### Clientes
- `POST /clients` - Crear cliente
- `GET /clients` - Listar clientes
- `GET /clients/:id` - Obtener cliente
- `PUT /clients/:id` - Actualizar cliente
- `DELETE /clients/:id` - Eliminar cliente

### Servicios
- `POST /services` - Crear servicio de transporte
- `GET /services` - Listar servicios (acepta `?clientId=CLI-0000001`)
- `GET /services/:id` - Obtener servicio con datos del cliente
- `PATCH /services/:id/status` - Cambiar estado (PENDING, IN_TRANSIT, DELIVERED, CANCELLED)

### Facturación
- `GET /billing/pending` - Ver servicios pendientes de facturar
- `POST /billing/process` - Ejecutar facturación por lotes (`{ "receiptBookId": "TAL-0000001" }`)
- `GET /billing/batches` - Listar lotes de facturación
- `GET /billing/batches/:id` - Detalle de un lote con sus facturas

### Talonarios
- `POST /receipt-books` - Crear talonario
- `GET /receipt-books` - Listar talonarios
- `GET /receipt-books/:id` - Obtener talonario
- `PUT /receipt-books/:id` - Actualizar talonario
- `DELETE /receipt-books/:id` - Eliminar talonario

### Health
- `GET /health` - Estado del servicio
