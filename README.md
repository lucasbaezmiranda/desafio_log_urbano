# Desafío Log Urbano - Sistema de Facturación por Lotes

Sistema de facturación por lotes para una empresa de logística. Permite registrar clientes, servicios de transporte y generar facturas agrupadas en lotes.

## Arquitectura

Monorepo con tres componentes:

- **backend/** - API REST con NestJS + TypeORM + PostgreSQL
- **frontend/** - Aplicación React (en desarrollo)
- **infra/** - Infraestructura con Terraform (en desarrollo)

## Modelo de Datos

```
Client (CLI-0000001)
  └── Service (SRV-0000001)           // Servicio de transporte
        └── BillingPending (PEN-0000001)  // Marca como pendiente de facturar

ReceiptBook (TAL-0000001)             // Talonario / punto de venta
  └── InvoiceBatch (LOT-0000001)      // Lote de facturas
        └── Invoice (FAC-0000001)     // Factura individual
              └── BillingPending      // Vincula factura con servicio
```

Cada entidad usa un ID custom con formato `XXX-0000001`, generado con secuencias de PostgreSQL para garantizar atomicidad.

## Flujo de Facturación

1. Se registran **clientes** con su condición fiscal (RI, Monotributo, Exento, CF)
2. Se cargan **servicios** de transporte asociados a un cliente
3. Los servicios entregados generan un registro en **billing_pending** (pendiente de facturar)
4. Se selecciona un **talonario** activo y se ejecuta el proceso de facturación por lotes
5. El sistema agrupa los pendientes por cliente, genera las **facturas** y las agrupa en un **lote**
6. Cada factura puede incluir CAE y fecha de vencimiento (integración AFIP)

## Decisiones Técnicas

- **IDs custom con secuencias PostgreSQL**: Legibles para el negocio y atómicos a nivel de base de datos
- **TypeORM con synchronize en dev**: Las tablas se crean automáticamente. En producción se usarían migraciones
- **Enums como tipos PostgreSQL**: Validación a nivel de base de datos, no solo en la app
- **ValidationPipe global**: Validación automática de DTOs con class-validator
- **Docker multistage**: Imagen de producción liviana sin dependencias de desarrollo

## Levantar el Proyecto

```bash
# Clonar y entrar al directorio
git clone <repo-url>
cd desafio_log_urbano

# Copiar variables de entorno
cp .env.example .env

# Levantar con Docker
docker-compose up

# El backend estará disponible en http://localhost:3001
# Health check: GET http://localhost:3001/health
```

## Endpoints Disponibles

### Clientes
- `POST /clients` - Crear cliente
- `GET /clients` - Listar clientes
- `GET /clients/:id` - Obtener cliente
- `PUT /clients/:id` - Actualizar cliente
- `DELETE /clients/:id` - Eliminar cliente

### Talonarios
- `POST /receipt-books` - Crear talonario
- `GET /receipt-books` - Listar talonarios
- `GET /receipt-books/:id` - Obtener talonario
- `PUT /receipt-books/:id` - Actualizar talonario
- `DELETE /receipt-books/:id` - Eliminar talonario

### Health
- `GET /health` - Estado del servicio
