# Apoint App — Sprint 0

Base de implementación inicial para SaaS de citas.

## Estructura

- `apps/web`: Next.js (dashboard + reservas públicas)
- `apps/api`: NestJS (API multi-tenant)
- `packages/config`: configuración compartida (placeholder)

## Requisitos

- Node.js 20+
- npm 10+

## Comandos

```bash
npm install
npm run dev
npm run dev:web
npm run dev:api
npm run test:e2e -w @apoint/api
```

## Docker Compose (PostgreSQL + Redis)

Levantar infraestructura local:

```bash
docker compose up -d postgres redis
```

Apagar infraestructura local:

```bash
docker compose down
```

Puertos:
- PostgreSQL: `localhost:55432`
- Redis: `localhost:6379`

## Prisma (API)

```bash
npx prisma generate --schema apps/api/prisma/schema.prisma
npx prisma migrate dev --schema apps/api/prisma/schema.prisma --name init
npm run seed:demo -w @apoint/api
```

`seed:demo` crea (o actualiza) un tenant demo con usuario, staff, servicio, disponibilidad y citas de ejemplo para probar el dashboard:
- email: `owner@demo.com`
- password: `Password123`

## Variables de entorno

Copiar `.env.example` en `.env` y completar valores.

## API disponible (Sprint 1 base)

## Control de planes aplicado (MVP)

- `free`: máximo 1 empleado (`/staff`) y máximo 50 citas/mes
- `pro`: máximo 5 empleados y citas/mes ilimitadas
- `business`: empleados y citas/mes ilimitados

## Seguridad MVP aplicada

- Rate limiting en rutas públicas (`/public/*`) y auth (`/auth/login`, `/auth/register`)
- Auditoría (`AuditLog`) para acciones sensibles:
	- `TENANT_SETTINGS_UPDATED`
	- `BOOKING_CREATED`, `BOOKING_CANCELLED`, `BOOKING_RESCHEDULED`
	- `CUSTOMER_UPDATED`

Pruebas e2e disponibles en API (`npm run test:e2e -w @apoint/api`):
- Reglas críticas de reservas (colisiones y límite mensual del plan `free`)
- Auditoría de creación de reservas
- Rate limiting en rutas públicas
- Flujo público: slots, auto-waitlist por slot ocupado y notificación de waitlist al cancelar
- Smoke MVP: registro de negocio -> setup base -> reserva pública completa
- Aislamiento multi-tenant: sin acceso cruzado entre tenants

Pruebas unitarias disponibles en API (`npm run test:unit -w @apoint/api`):
- Colisiones de horario
- Políticas de cancelación/reprogramación por ventana de aviso
- Límites de reservas por día/semana/mes (plan `free`)
- Generación de slots públicos (reglas, excepciones y buffer)

### Health
- `GET /health`

### Auth
- `POST /auth/register`
	- body: `{ "tenantName": "Demo", "email": "owner@demo.com", "password": "Password123" }`
- `POST /auth/login`
	- body: `{ "email": "owner@demo.com", "password": "Password123" }`
- `GET /auth/me` (Bearer token)

### Services (protegido con Bearer)
- `POST /services`
- `GET /services`
- `PATCH /services/:id`
- `DELETE /services/:id`

### Staff (protegido con Bearer)
- `POST /staff`
- `GET /staff`
- `PATCH /staff/:id`
- `DELETE /staff/:id`

### Availability (protegido con Bearer)
- `POST /availability/rules`
- `GET /availability/rules`
- `PATCH /availability/rules/:id`
- `DELETE /availability/rules/:id`
- `POST /availability/exceptions`
- `GET /availability/exceptions`
- `PATCH /availability/exceptions/:id`
- `DELETE /availability/exceptions/:id`

### Bookings (protegido con Bearer)
- `POST /bookings`
- `GET /bookings`
- `PATCH /bookings/:id/cancel`
- `PATCH /bookings/:id/reschedule`
- `POST /bookings` soporta `customFields` (objeto JSON)

### Dashboard (protegido con Bearer)
- `GET /dashboard/appointments?range=day|week|month&date=YYYY-MM-DD&staffId=...&status=...`
	- Devuelve citas del período + resumen (`totalAppointments`, `totalScheduledMinutes`, `byStatus`, `byStaff`)

### Auditoría (protegido con Bearer)
- `GET /audit/logs?action=...&actorUserId=...&from=...&to=...&limit=...&cursor=...`
	- Lista logs de auditoría del tenant autenticado
	- Filtros opcionales: acción, actor, rango de fechas ISO, límite (máx. 200) y cursor
	- Respuesta: `{ items: AuditLog[], nextCursor: string | null }`

## Frontend MVP (dashboard básico)

- Abrir `http://localhost:3000/login`
- Login directo (email/password contra `/auth/login`)
- El token se guarda en `localStorage` automáticamente
- Dashboard en `http://localhost:3000/dashboard`
- Seleccionar rango `day`, `week` o `month` y fecha base
- Filtro de staff por nombre (dropdown cargado desde `GET /staff`)
- Filtro de estado por dropdown (`pending`, `confirmed`, `cancelled`, `rescheduled`, `no_show`, `completed`)
- Consumir en vivo `GET /dashboard/appointments`
- Consultar auditoría con filtros (`action`, `actorUserId`, fechas, `limit`) y paginación por `nextCursor`
- Acciones rápidas para crear `service`, `staff` y `booking` desde la misma vista

### CRM Clientes (protegido con Bearer)
- `GET /customers?search=...`
- `GET /customers/:id` (incluye historial de citas)
- `PATCH /customers/:id` (notas internas, teléfono, nombre, metadata)

Notas CRM:
- Cada nueva reserva hace `upsert` automático del cliente por `(tenantId, email)`.
- `POST /bookings` guarda y vincula `customerId` en la cita para historial.

### Tenant Settings (protegido con Bearer)
- `GET /tenant/settings`
- `PATCH /tenant/settings`
	- `bookingBufferMinutes`
	- `maxBookingsPerDay`
	- `maxBookingsPerWeek`
	- `cancellationNoticeHours`
	- `rescheduleNoticeHours`
	- `bookingFormFields` (array de campos configurables)

### Public Booking (sin auth)
- `GET /public/:slug`
- `GET /public/:slug/services`
- `GET /public/:slug/staff`
- `GET /public/:slug/form`
- `GET /public/:slug/slots?serviceId=...&staffId=...&date=YYYY-MM-DD`
- `POST /public/:slug/bookings`
- `POST /public/:slug/waitlist`

## Notificaciones (stub actual)

Cuando se crea una reserva (privada o pública), la API emite logs de correo stub:
- Confirmación al cliente
- Aviso de nueva reserva al negocio
- Cuando se cancela una reserva y hay lista de espera para ese slot, se emite aviso al siguiente en cola

## Nota importante

El backend del MVP ya usa persistencia real con Prisma + PostgreSQL.
