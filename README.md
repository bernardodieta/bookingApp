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
npm run dev:prep
npm run dev:reset:win
npm run qa:email:local
npm run qa:secrets:local
npm run qa:env:staging:init
npm run qa:env:prod:init
npm run qa:preflight:mvp
npm run qa:preflight:staging
npm run qa:preflight:prod
npm run qa:preflight:staging:strict
npm run qa:preflight:prod:strict
npm run qa:smoke:mvp
npm run qa:smoke:staging
npm run qa:smoke:prod
npm run qa:smoke:widget
npm run qa:smoke:widget:staging
npm run qa:smoke:widget:prod
npm run qa:staging:gate
npm run qa:staging:gate:widget
npm run qa:staging:gate:local
npm run qa:staging:gate:quick
npm run qa:staging:gate:widget:local
npm run qa:staging:gate:widget:quick
npm run qa:staging:gate:strict
npm run qa:staging:gate:strict:quick
npm run qa:staging:gate:strict:widget
npm run qa:staging:gate:strict:widget:local
npm run qa:staging:gate:strict:widget:quick
npm run qa:prod:gate
npm run qa:prod:gate:widget
npm run qa:prod:gate:dry
npm run qa:prod:gate:widget:dry
npm run qa:prod:gate:strict:widget
npm run qa:prod:gate:strict
npm run qa:release:staging
npm run qa:release:staging:widget
npm run qa:release:staging:widget:quick
npm run qa:release:prod
npm run qa:release:prod:widget
npm run qa:release:prod:widget:dry
npm run qa:release:help
npm run qa:release:doctor
npm run qa:release:doctor:staging:widget:local
npm run qa:release:doctor:failfast
npm run qa:release:doctor:failfast:staging:widget:local
npm run test:e2e -w @apoint/api
```

Notas de arranque en Windows:
- `npm run dev` ahora ejecuta `dev:prep` para limpiar artefactos (`apps/web/.next`, `apps/api/dist`) antes de iniciar.
- Si quedó un proceso Node colgado (puertos ocupados o locks), usa `npm run dev:reset:win` y vuelve a ejecutar `npm run dev`.

## Docker Compose (PostgreSQL + Redis)

Levantar infraestructura local:

```bash
docker compose up -d postgres redis
```

SMTP local (sin SendGrid):

```bash
npm run qa:email:local
docker compose up -d mailpit
```

Mailpit UI: `http://localhost:8025`

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

Notificaciones email (MVP):
- Proveedor principal: `SendGrid` (`SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`)
- Fallback automático: `Nodemailer SMTP` si SendGrid falla (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`)
- Destinatario opcional para alertas al negocio: `NOTIFICATIONS_BUSINESS_EMAIL`

Preflight de configuración MVP:
- `npm run qa:secrets:local` genera/rota secretos JWT locales en `.env` (sin exponer valores)
- `npm run qa:email:local` configura fallback SMTP local para pruebas de email sin SendGrid
- `npm run qa:preflight:mvp` valida variables mínimas y setup de email
- `npm run qa:preflight:staging` valida configuración para staging
- `npm run qa:preflight:prod` valida configuración para producción
- `npm run qa:preflight:staging:strict` y `npm run qa:preflight:prod:strict` fallan también con warnings

Bootstrap de entorno remoto:
- `npm run qa:env:staging:init` crea `.env.staging` con plantilla inicial
- `npm run qa:env:prod:init` crea `.env.prod` con plantilla inicial

Smoke multi-entorno:
- `npm run qa:smoke:mvp` usa `API_URL` o `http://localhost:3001`
- `npm run qa:smoke:staging` usa `STAGING_API_URL`
- `npm run qa:smoke:prod` usa `PROD_API_URL`
- `npm run qa:smoke:widget` valida específicamente dominio custom + `widget-config` + `widget.js`
- `npm run qa:smoke:widget:staging` usa `STAGING_API_URL` en modo widget-only
- `npm run qa:smoke:widget:prod` usa `PROD_API_URL` en modo widget-only
- override opcional: `node scripts/mvp-go-live-smoke.js --api-url=https://tu-api`
- modos disponibles: `--mode=full` (default) y `--mode=widget`

Gate por entorno (preflight + migrate + smoke):
- `npm run qa:staging:gate`
- `npm run qa:staging:gate:widget` gate de staging con smoke widget-only
- `npm run qa:staging:gate:local` simula staging usando API local (`http://localhost:3001`) y omite migraciones
- `npm run qa:staging:gate:quick` alias recomendado para local sin flags extra
- `npm run qa:staging:gate:widget:local` igual que local, pero ejecuta smoke en modo widget-only
- `npm run qa:staging:gate:widget:quick` alias recomendado para widget local sin flags extra
- `npm run qa:staging:gate:strict` exige preflight sin warnings
- `npm run qa:staging:gate:strict:quick` strict local sin flags extra
- `npm run qa:staging:gate:strict:widget` strict + smoke widget-only en staging
- `npm run qa:staging:gate:strict:widget:local` local + strict + smoke widget-only
- `npm run qa:staging:gate:strict:widget:quick` strict widget local sin flags extra
- `npm run qa:prod:gate`
- `npm run qa:prod:gate:widget` gate de prod con smoke widget-only
- `npm run qa:prod:gate:dry` valida estricto sin migraciones/smoke (chequeo rápido)
- `npm run qa:prod:gate:widget:dry` dry-run estricto para release de dominio/widget
- `npm run qa:prod:gate:strict:widget` strict + smoke widget-only en prod
- `npm run qa:prod:gate:strict` exige preflight sin warnings
- flags opcionales: `node scripts/mvp-env-gate.js --env=staging --skip-migrate --skip-smoke --smoke-mode=widget`

Runbook operativo (incidentes + rollback dominio/widget):
- [docs/runbooks/domain-widget-release.md](docs/runbooks/domain-widget-release.md)

One-click release commands:
- `npm run qa:release:staging` (strict full)
- `npm run qa:release:staging:widget` (strict widget)
- `npm run qa:release:staging:widget:quick` (strict widget local rápido)
- `npm run qa:release:prod` (strict full)
- `npm run qa:release:prod:widget` (strict widget)
- `npm run qa:release:prod:widget:dry` (dry-run widget)
- `npm run qa:release:help` (muestra comando recomendado por escenario)
- `npm run qa:release:doctor` (verifica prerequisitos)
- `npm run qa:release:doctor:staging:widget:local` (doctor local para flujo widget)
- validación tenant opcional: `npm run qa:release:doctor -- --env=staging --mode=widget --scope=local --api-url=http://localhost:3001 --tenant-slug=mi-slug`
- `npm run qa:release:doctor:failfast` (termina en el primer error bloqueante)
- `npm run qa:release:doctor:failfast:staging:widget:local` (failfast local para widget)

VS Code Tasks disponibles en `.vscode/tasks.json`:
- `Release Staging Widget Quick`
- `Release Staging Full`
- `Release Prod Widget Dry`

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
- CRUD de disponibilidad autenticado (update/delete de rules y exceptions)
- Auditoría de creación de reservas
- Rate limiting en rutas públicas
- Flujo público: slots, auto-waitlist por slot ocupado y notificación de waitlist al cancelar
- Flujo público configurable: `bookingFormFields` expuestos por slug y validación backend de campos requeridos
- Recordatorios email configurables por tenant (`reminderHoursBefore`) + runner deduplicado por auditoría
- Smoke MVP: registro de negocio -> setup base -> reserva pública completa
- Aislamiento multi-tenant: sin acceso cruzado entre tenants

Pruebas unitarias disponibles en API (`npm run test:unit -w @apoint/api`):
- AvailabilityService: update/remove de rules/exceptions + validaciones de tenant/not found
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
- `POST /bookings/reminders/run` (ejecuta envío de recordatorios para ventana activa)
- Scheduler automático de recordatorios activo por defecto (ciclo cada 5 min)
	- `REMINDERS_AUTO_ENABLED=false` para deshabilitarlo
	- `REMINDERS_RUN_INTERVAL_MS=300000` para ajustar intervalo (mínimo 15000)
- `POST /bookings` soporta `customFields` (objeto JSON)

### Payments (protegido con Bearer)
- `POST /payments` (registro manual de `full` o `deposit`)
	- body base: `{ "bookingId": "...", "mode": "full|deposit", "amount?": 40, "method?": "cash|card|transfer|link|stripe" }`
- `POST /payments/stripe/checkout-session` (crea sesión Checkout de Stripe)
- `POST /payments/stripe/confirm` (confirma sesión pagada y registra el pago en sistema)
- `GET /payments?bookingId=...&customerId=...&status=...&kind=...`
- `GET /payments/:id/sale-note` (nota de venta/factura básica)
- Política de reembolso configurable en `PATCH /tenant/settings` con `refundPolicy: "none" | "credit" | "full"`
	- Al cancelar una reserva pagada:
		- `full`: genera un `payment` de tipo `refund`
		- `credit`: registra crédito para próxima cita en auditoría
		- `none`: no genera devolución

Variables para Stripe:
- `STRIPE_SECRET_KEY` (obligatoria para crear/confirmar sesiones)
- `NEXT_PUBLIC_APP_URL` o `WEB_BASE_URL` (opcional, para construir URLs de success/cancel)

Nota de roadmap de pagos:
- MercadoPago queda diferido para una fase posterior (PG-03), no activo en MVP actual.

### Dashboard (protegido con Bearer)
- `GET /dashboard/appointments?range=day|week|month&date=YYYY-MM-DD&staffId=...&status=...`
	- Devuelve citas del período + resumen (`totalAppointments`, `totalScheduledMinutes`, `byStatus`, `byStaff`)
- `GET /dashboard/reports?range=day|week|month&date=YYYY-MM-DD`
	- Devuelve KPIs comerciales: ingresos netos, cancelaciones, clientes frecuentes, servicios más demandados y horas pico

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
- Página pública funcional por slug en `http://localhost:3000/public/:slug`
- Seleccionar rango `day`, `week` o `month` y fecha base
- Filtro de staff por nombre (dropdown cargado desde `GET /staff`)
- Filtro de estado por dropdown (`pending`, `confirmed`, `cancelled`, `rescheduled`, `no_show`, `completed`)
- Consumir en vivo `GET /dashboard/appointments`
- Consultar auditoría con filtros (`action`, `actorUserId`, fechas, `limit`) y paginación por `nextCursor`
- Acciones rápidas para crear `service`, `staff`, `booking`, `availability rule` y `availability exception` desde la misma vista
- Panel de visibilidad para listar `availability rules` y `availability exceptions` con refresh manual
- Acciones mínimas para editar/eliminar disponibilidad: toggle y delete de rules, edición de nota/tipo y delete de exceptions
- Editor MVP de `tenant settings` para actualizar `bookingFormFields` (JSON) desde dashboard
- Presets rápidos en dashboard para `bookingFormFields`: `phone`, `dni`, `notes`
- Acciones desde tabla para cancelar y reprogramar bookings
- Acción rápida para agregar clientes a waitlist desde dashboard (`POST /bookings/waitlist`)

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
	- `reminderHoursBefore` (horas antes de la cita para recordatorio; `0` desactiva)
	- `bookingFormFields` (array de campos configurables; `required: true` exige `customFields[key]` al reservar)

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
