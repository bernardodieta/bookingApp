# 🚀 SaaS de Gestión de Citas — Documento de Inicio de Implementación

> Basado en: `saas-citas-propuesta.md`  
> Fecha: Febrero 2026  
> Objetivo: iniciar implementación sin omitir requisitos funcionales, técnicos y de negocio.

Resumen ejecutivo para cliente/equipo no técnico:
- `saas-citas-resumen-ejecutivo.md`

## Estado actual (actualizado 2026-02-18)

Resumen ejecutivo:
- MVP backend y frontend funcional en operación local.
- Flujo público por slug implementado con formulario configurable (`bookingFormFields`).
- Validación de campos requeridos aplicada tanto en frontend como en backend.
- Notificaciones email implementadas con fallback SendGrid → Nodemailer.
- Recordatorios NT-04 ejecutándose automáticamente por scheduler en backend.
- Pagos MVP visibles en dashboard (registro + historial + nota de venta básica).
- Política de reembolso configurable por tenant aplicada en cancelaciones (`none|credit|full`).
- Stripe integrado en pagos (`checkout-session` + confirmación de sesión pagada).
- Dashboard reorganizado por menús de sección (overview/pagos/operación/settings/auditoría).
- Branding por tenant implementado (`logoUrl`, `primaryColor`) y aplicado en pública/dashboard.
- Zona horaria por tenant implementada end-to-end (slots, reportes, recordatorios).
- Idioma base por tenant (ES/EN) aplicado en flujo público principal.
- Dominio custom y widget embebible implementados (incluye `widget-config` y `widget.js`).
- Release ops endurecido: smoke widget, gate widget, one-click release y release doctor.
- Suite e2e crítica pasando (17/17).
- Integraciones calendario (IN-01/IN-02) en scaffold técnico inicial: persistencia, endpoints base, webhook handlers y auditoría inicial.
- Integraciones calendario: sincronización saliente inicial activa para Google en `BOOKING_CREATED/RESCHEDULED/CANCELLED` (best-effort con `CalendarEventLink` y auditoría de éxito/error).

Pendiente inmediato para cierre de go-live MVP:
- Validación real de entorno staging/prod con variables no-placeholder.
- Validación real de proveedor SendGrid con credenciales reales (cuando se habiliten).
- Verificación final de DNS/TLS en dominio custom de negocio real.

---

## 1) Objetivo de Implementación

Construir una plataforma SaaS multi-tenant de reservas para negocios con:
- Dashboard de administración (negocio)
- Página pública de reservas (cliente final)
- Control de planes (Free / Pro / Business)
- Base preparada para escalar a pagos, automatizaciones e integraciones

---

## 2) Alcance por Fases (obligatorio)

## Fase 1 — MVP (2–3 meses)
Incluye:
- Registro/autenticación de negocio
- Configuración de servicios, empleados y horarios
- Página pública de reservas funcional
- Notificaciones por email
- Plan Free operativo

No incluye en MVP:
- Pagos en línea
- WhatsApp/SMS
- Multi-sede
- Dominio personalizado
- Integraciones externas (Calendar, Zoom, Zapier)

## Fase 2 — Monetización (1–2 meses)
Incluye:
- Stripe + MercadoPago
- SMS + WhatsApp
- CRM básico de clientes
- Plan Pro operativo

## Fase 3 — Escala (2–3 meses)
Incluye:
- Reportes avanzados + exportación
- Multi-sede
- Dominio personalizado
- Widget embebible
- Integraciones (Google Calendar, Outlook, Zoom, Meet, Zapier)
- Plan Business operativo

---

## 3) Requisitos Funcionales Trazables (Checklist Maestro)

Usar estos IDs para historias, PRs y QA.

### 3.1 Agenda (AG)
- [x] **AG-01** Calendario con vista día/semana/mes
- [x] **AG-02** Disponibilidad configurable por negocio
- [x] **AG-03** Disponibilidad configurable por empleado
- [x] **AG-04** Bloqueo de festivos/vacaciones/no disponibilidad
- [x] **AG-05** Soporte multi-empleado por cuenta
- [x] **AG-06** Buffer entre citas configurable
- [x] **AG-07** Límite máximo de reservas por día/semana

### 3.2 Reservas Online (RS)
- [x] **RS-01** Página pública por negocio (`/slug-negocio`)
- [x] **RS-02** Flujo de reserva: servicio → empleado → horario → datos
- [x] **RS-03** Formulario de cliente configurable
- [x] **RS-04** Reglas de cancelación y reprogramación configurables
- [x] **RS-05** Lista de espera automática por cupo lleno
- [x] **RS-06** Reasignación de cupo y notificación al siguiente en lista

### 3.3 Notificaciones (NT)
- [x] **NT-01** Confirmación inmediata por email
- [ ] **NT-02** Confirmación inmediata por SMS (Pro+)
- [ ] **NT-03** Confirmación inmediata por WhatsApp (Pro+)
- [x] **NT-04** Recordatorios automáticos configurables (ej. 24h, 2h)
- [x] **NT-05** Notificación al negocio por nueva/modificada/cancelada

### 3.4 Gestión de Negocio (GN)
- [x] **GN-01** Catálogo de servicios (nombre, duración, precio)
- [x] **GN-02** CRM básico (historial, notas, contacto)
- [x] **GN-03** Panel global de citas del día/semana
- [x] **GN-04** Política de cancelación (reembolso/crédito/sin devolución)
- [ ] **GN-05** Multi-sede (Business)

### 3.5 Pagos (PG)
- [x] **PG-01** Pago completo o depósito parcial
- [x] **PG-02** Integración Stripe
- [ ] **PG-03** Integración MercadoPago (diferido por decisión de producto)
- [x] **PG-04** Nota de venta/factura básica
- [x] **PG-05** Política de reembolso configurable
- [x] **PG-06** Historial de pagos por cliente

### 3.6 Reportes (RP)
- [x] **RP-01** Dashboard: citas por período
- [x] **RP-02** Dashboard: ingresos
- [x] **RP-03** Dashboard: tasa de cancelación
- [x] **RP-04** Clientes frecuentes
- [x] **RP-05** Servicios más demandados
- [x] **RP-06** Horas pico
- [ ] **RP-07** Exportación Excel/PDF (Business)

### 3.7 Personalización (PZ)
- [x] **PZ-01** Logo + colores en página pública
- [ ] **PZ-02** Mensajes personalizados en emails/confirmaciones
- [x] **PZ-03** Idioma configurable
- [x] **PZ-04** Zona horaria configurable
- [x] **PZ-05** Dominio personalizado (Business)
- [x] **PZ-06** Widget embebible

### 3.8 Integraciones (IN)
- [ ] **IN-01** Google Calendar bidireccional
- [ ] **IN-02** Outlook Calendar bidireccional
- [ ] **IN-03** Google Meet auto-link en cita virtual
- [ ] **IN-04** Zoom auto-link en cita virtual
- [ ] **IN-05** WhatsApp Business
- [ ] **IN-06** Reserva desde Instagram/Facebook
- [ ] **IN-07** Zapier

Estado de avance real (2026-02-18):
- ✅ Fase A (base técnica) iniciada para IN-01/IN-02:
  - Modelo de datos: `CalendarAccount` y `CalendarEventLink`.
  - Endpoints backend creados: connect/list/resync/disconnect + webhooks Google/Microsoft.
  - Cifrado de tokens OAuth en reposo (`CALENDAR_TOKENS_ENCRYPTION_KEY`).
  - Auditoría base: conexión, resync, desconexión, inbound webhook.
- ✅ Fase B parcial (Google outbound, sin cola dedicada aún):
  - `BOOKING_CREATED` crea/actualiza evento en Google Calendar por cuentas conectadas del staff.
  - `BOOKING_RESCHEDULED` actualiza evento vinculado.
  - `BOOKING_CANCELLED` elimina evento vinculado (si existe).
  - Persistencia de vínculo en `CalendarEventLink` + auditoría `CAL_SYNC_OUTBOUND_OK`/`CAL_SYNC_ERROR`.
- ⏳ Pendiente para marcar IN-01/IN-02 como completos:
  - OAuth completo (authorize + callback + refresh) por provider.
  - Cola `calendar.sync.outbound` con reintentos/backoff y dead-letter.
  - Sync inbound real (provider -> Apoint) con delta/sync cursor.
  - Resolución de conflictos + idempotencia por versión/etag.
  - UI dashboard de Integraciones.

### 3.8.1 Plan técnico de implementación (IN-01 e IN-02)

Objetivo:
- Sincronizar citas de Apoint con Google Calendar y Outlook en doble vía (crear, editar, cancelar) con idempotencia y resolución de conflictos.

Alcance inicial recomendado:
- Conexión de calendario por staff (prioridad), con opción futura por tenant global.
- Fuente de verdad inicial: booking en Apoint.
- Bidireccional real vía webhooks + sync incremental (delta/cursor).

Fase A — Conexión de cuenta (OAuth + almacenamiento seguro)
- Google:
  - OAuth2 con scopes de calendario.
  - Guardar access token, refresh token, expiración y calendarId principal.
- Microsoft (Outlook):
  - OAuth2 (Microsoft Graph) con permisos de calendario.
  - Guardar tokens, expiración y calendarId.
- Persistencia mínima (Prisma):
  - calendar_accounts: id, tenantId, staffId, provider (google|microsoft), externalAccountId, calendarId, accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt, status, lastSyncAt, createdAt, updatedAt.

Fase B — Sincronización saliente (Apoint -> Calendar)
- Trigger en eventos de booking:
  - BOOKING_CREATED -> create event externo.
  - BOOKING_RESCHEDULED -> update event externo.
  - BOOKING_CANCELLED -> cancel/delete event externo.
- Persistencia de vínculo:
  - calendar_event_links: id, tenantId, bookingId, accountId, provider, externalEventId, externalICalUID, lastExternalVersion, syncStatus, lastSyncedAt.
- Cola de jobs obligatoria:
  - calendar.sync.outbound con reintentos y dead-letter.

Fase C — Sincronización entrante (Calendar -> Apoint)
- Webhooks:
  - Google channels para cambios de eventos.
  - Microsoft Graph subscriptions para eventos.
- Consumo incremental:
  - Google sync token.
  - Microsoft delta query.
- Resolución de cambio externo:
  - Si existe link bookingId<->externalEventId: actualizar o cancelar booking según reglas.
  - Si no existe link: crear evento interno provisional o registrar como conflicto manual (según política del negocio).

Fase D — Reglas de conflicto y consistencia
- Idempotencia por provider + externalEventId + version/etag.
- Política por defecto:
  - Cambios en Apoint tienen prioridad en colisiones duras.
  - Cambios externos fuera de colisión se aceptan.
- Auditoría obligatoria:
  - CAL_SYNC_CONNECTED, CAL_SYNC_OUTBOUND_OK, CAL_SYNC_INBOUND_OK, CAL_SYNC_CONFLICT, CAL_SYNC_ERROR.

Fase E — UX Dashboard
- Nueva sección Integraciones:
  - Conectar Google / Conectar Outlook.
  - Estado de conexión, última sincronización, errores recientes.
  - Botón de reconectar y desconectar.
  - Botón de re-sync manual por staff.

API/Backend mínimo sugerido
- POST /integrations/calendar/google/connect
- POST /integrations/calendar/microsoft/connect
- GET /integrations/calendar/accounts
- POST /integrations/calendar/accounts/:id/resync
- DELETE /integrations/calendar/accounts/:id
- POST /integrations/calendar/webhooks/google
- POST /integrations/calendar/webhooks/microsoft

Seguridad y operación
- Encriptar tokens en reposo.
- Rotar refresh tokens y manejar revocaciones.
- Validar firma/origen de webhooks.
- Rate limiting en endpoints webhook.
- Métricas: lag de sync, fallos por provider, conflictos por tenant.

Criterios de aceptación IN-01 / IN-02
- Crear cita en Apoint crea evento en calendario externo conectado.
- Reprogramar/cancelar cita en Apoint actualiza evento externo.
- Cambios externos (hora/cancelación) se reflejan en Apoint dentro de ventana definida.
- Reintentos automáticos en fallos transitorios, sin duplicados.
- Evidencia en auditoría para operaciones de sincronización y conflictos.

### 3.9 Diferenciadores (DF)
- [x] **DF-01** Lista de espera automática
- [ ] **DF-02** Reserva por WhatsApp
- [x] **DF-03** Widget embebible con 1 línea
- [ ] **DF-04** Multi-empleado real (agenda y servicios por empleado)
- [ ] **DF-05** Reseñas post-cita

### 3.10 Portal Cliente y Fidelización (CL)
- [x] **CL-01** Registro opcional de cliente final (sin bloquear reserva rápida)
- [x] **CL-02** Login cliente por email/contraseña
- [x] **CL-03** Vista “Mis citas” (historial + próximas)
- [x] **CL-04** Vinculación automática de historial por email (claim)
- [x] **CL-05** Google SSO para cliente final

### 3.10.1 Plan técnico de implementación (CL-01 a CL-05)

Objetivo:
- Permitir que el cliente final cree cuenta opcional para gestionar y consultar sus citas, preservando conversión del flujo público y preparando fidelización.

Fase A — Cuenta cliente opcional (MVP inicial)
- Modelo `CustomerAccount` por tenant, vinculado opcionalmente a `Customer`.
- Endpoints de registro/login separados del auth de negocio.
- Token propio para cliente (`scope=customer`).

Fase B — Portal “Mis citas” (MVP funcional)
- Endpoint autenticado para listar citas del cliente por `customerId` o `customerEmail`.
- UI pública para login y consulta de próximas/históricas.

Fase C — Claim de historial
- Si el cliente creó cuenta después de reservar como invitado, enlazar historial existente por email normalizado.
- Política de seguridad mínima: validación de ownership por tenant y sesión cliente.

Fase D — Google SSO
- Inicio con `id_token` de Google en frontend.
- Verificación backend de token + audience + email verificado.
- Upsert de cuenta cliente (`googleSub`) y emisión de token de portal.

Fase E — Endurecimiento y métricas
- Auditoría (`CUSTOMER_PORTAL_*`) para registro/login/fallo.
- Rate limit reforzado en endpoints de auth cliente.
- Métricas básicas: tasa de registro, login, conversión guest→account.

API mínima sugerida (MVP):
- `POST /public/:slugOrDomain/customer-portal/register`
- `POST /public/:slugOrDomain/customer-portal/login`
- `POST /public/:slugOrDomain/customer-portal/google`
- `GET /public/:slugOrDomain/customer-portal/me`
- `GET /public/:slugOrDomain/customer-portal/bookings`

Criterios de aceptación (MVP):
- Cliente puede crear cuenta sin afectar flujo de reserva sin cuenta.
- Cliente autenticado puede consultar sus citas pasadas y futuras.
- Citas existentes por email se reflejan en portal tras registro.
- Login Google operativo para tenant con configuración habilitada.

---

## 4) Requisitos No Funcionales (NFR)

### 4.1 Seguridad
- [ ] **NFR-SEC-01** HTTPS obligatorio
- [x] **NFR-SEC-02** Rate limit en endpoints públicos
- [ ] **NFR-SEC-03** Validación frontend + backend con Zod
- [x] **NFR-SEC-04** Aislamiento por tenant con `tenant_id`
- [ ] **NFR-SEC-05** Row-Level Security en PostgreSQL
- [ ] **NFR-SEC-06** Secretos en variables de entorno seguras
- [x] **NFR-SEC-07** Auditoría de acciones sensibles
- [ ] **NFR-SEC-08** Principios GDPR/privacidad

### 4.2 Escalabilidad y operación
- [ ] **NFR-OPS-01** Cola de jobs para notificaciones y recordatorios
- [ ] **NFR-OPS-02** Caché de disponibilidad
- [x] **NFR-OPS-03** Multi-tenant sin fuga de datos
- [ ] **NFR-OPS-04** CI/CD con checks automáticos

---

## 5) Arquitectura Base a Implementar

### 5.1 Frontend (Next.js)
- App A: Dashboard del negocio
- App B: Página pública de reservas
- Tech: Next.js 14+, TypeScript, Tailwind, shadcn/ui, TanStack Query, React Hook Form + Zod, Zustand

### 5.2 Backend (NestJS)
- API REST o tRPC (definir 1 en kickoff técnico)
- Módulos: Auth, Tenants, Users, Services, Staff, Availability, Bookings, Notifications, Plans/Billing, Customers, Reports
- Tech: NestJS, TypeScript, Prisma, PostgreSQL, Redis, BullMQ, JWT + Refresh

### 5.3 Infraestructura
- Frontend: Vercel
- Backend + DB + Redis: Railway/Render
- DNS/CDN: Cloudflare
- CI/CD: GitHub Actions
- Storage archivos: Cloudflare R2 o S3

---

## 6) Modelo de Datos Inicial (mínimo para MVP)

Entidades base:
- `tenants` (negocio, plan, slug, timezone, locale)
- `users` (owner/admin/staff)
- `staff_profiles` (empleado por tenant)
- `services` (duración, precio, activo)
- `staff_services` (relación empleado-servicio)
- `availability_rules` (reglas semanales)
- `availability_exceptions` (feriados, vacaciones)
- `bookings` (estado, fecha/hora, fuente, notas)
- `booking_custom_fields` (campos dinámicos)
- `customers` (contacto, metadata)
- `notifications` (tipo, canal, estado, payload)
- `audit_logs` (acción sensible, actor, timestamp)

Estados recomendados de cita:
- `pending`, `confirmed`, `cancelled`, `rescheduled`, `no_show`, `completed`

---

## 7) Control de Planes y Feature Flags

### Free
- 1 usuario/empleado
- 50 citas/mes
- Email sí
- Sin SMS/WhatsApp/pagos

### Pro
- Hasta 5 usuarios
- Citas ilimitadas
- SMS/WhatsApp/pagos/CRM completo

### Business
- Usuarios ilimitados
- Multi-sede
- Dominio personalizado
- Reportes avanzados + exportación

Regla de implementación:
- Toda funcionalidad no-Free debe estar protegida por middleware/guard de plan.

---

## 8) Backlog Técnico Priorizado para Empezar

## Sprint 0 (1 semana)
- [x] Monorepo/apps + convenciones
- [x] Setup NestJS + Next.js + Prisma + PostgreSQL
- [ ] Pipeline CI básico (lint, typecheck, test)
- [x] Gestión de entornos (`.env` por ambiente)
- [x] Seed de tenant demo

## Sprint 1 (MVP Core)
- [x] Auth (registro/login/refresh/logout)
- [x] Multi-tenant (`tenant_id` obligatorio en dominio de datos)
- [x] CRUD servicios
- [x] CRUD empleados
- [x] Configuración disponibilidad
- [x] Reserva pública paso a paso
- [x] Confirmación email

## Sprint 2 (MVP Operable)
- [x] Calendario día/semana/mes en dashboard
- [x] Reglas cancelación/reprogramación
- [x] Buffer y límites de reserva
- [x] Panel diario/semanal de citas
- [x] Lista de espera básica
- [x] Hardening seguridad (rate limit + auditoría)

---

## 9) Criterios de Aceptación de MVP (Go-Live)

El MVP está listo solo si:
- [x] Un negocio puede registrarse y crear su configuración básica
- [x] Puede publicar su página de reservas por slug
- [x] Un cliente puede reservar de inicio a fin sin intervención humana
- [x] El negocio recibe notificación por nueva reserva
- [x] El cliente recibe confirmación por email
- [x] No hay acceso cruzado de datos entre tenants
- [x] Se respetan límites del plan Free (usuario y citas/mes)
- [x] Existe trazabilidad básica de auditoría

---

## 10) QA y Pruebas Mínimas Obligatorias

- [ ] Unit tests en reglas de disponibilidad y colisión de horarios
- [ ] Unit tests en políticas de cancelación/reprogramación
- [ ] Integration tests en flujo de reserva (API)
- [ ] E2E smoke test: registro negocio → crear servicio → reservar
- [ ] Test multi-tenant: aislamiento estricto por `tenant_id`

Estado real QA automático (2026-02-17):
- [x] Unit tests en reglas de disponibilidad y colisión de horarios
- [x] Unit tests en políticas de cancelación/reprogramación
- [x] Integration/E2E en flujo de reserva (API)
- [x] E2E smoke test: registro negocio → crear servicio → reservar
- [x] Test multi-tenant: aislamiento estricto por `tenant_id`
- [x] E2E flujo público configurable (`bookingFormFields`) y persistencia `customFields`
- [x] E2E validación backend de campos requeridos (`required: true`)

---

## 10.1) Runbook de prueba manual integrada (pendiente de cierre operativo)

Objetivo: validar de punta a punta que configuración desde dashboard impacta el formulario público y bloquea/permite reserva correctamente.

Precondiciones:
1. Infra local activa: `docker compose up -d postgres redis`
2. API + Web levantadas: `npm run dev`
3. Usuario de pruebas creado (o usar registro en UI).

Atajo automatizado (evidencia técnica rápida):
- Ejecutar `npm run qa:smoke:mvp` para validar por API:
  - registro tenant,
  - creación servicio/staff/disponibilidad,
  - configuración `bookingFormFields`,
  - rechazo por campo requerido faltante,
  - creación de reserva pública válida.

Pasos:
1. Login en `/login`.
2. En dashboard, crear/confirmar al menos 1 servicio y 1 staff.
3. Configurar disponibilidad con una regla activa para un día cercano.
4. En sección **Tenant Settings (MVP)**, guardar:
   ```json
   [
     { "key": "phone", "label": "Teléfono", "type": "tel", "required": true },
     { "key": "dni", "label": "DNI", "type": "text", "required": false }
   ]
   ```
5. Abrir `/public/<slug-del-tenant>`.
6. Verificar que aparecen campos dinámicos `Teléfono` y `DNI`.
7. Intentar reservar sin `Teléfono` → debe fallar con mensaje de campo requerido.
8. Reservar completando `Teléfono` → debe confirmar reserva o entrar a waitlist según ocupación.
9. Confirmar en dashboard/listado que la reserva existe.
10. Validar en API/DB (opcional) que `customFields` y `customer.phone` quedaron persistidos.

Criterio de salida:
- Si los pasos 6–10 son exitosos, RS-03 queda validado también en operación manual.

---

## 10.2) Gate final de Go-Live MVP

Checklist previo a liberar:
- [ ] Runbook manual integrada 10.1 ejecutado y evidenciado (capturas o notas).
- [ ] Prueba real SendGrid ejecutada con credenciales válidas.
- [ ] Variables de entorno productivas revisadas (sin secretos por defecto).
- [x] Build local sin errores (`web` y `api`).
- [x] Suite e2e crítica en verde.

---

## 10.3) Checklist preproducción por entorno

### DEV (local)
- [x] `docker compose up -d postgres redis` operativo.
- [x] `npm run build` sin errores en `web` y `api`.
- [x] `npm run test:e2e -w @apoint/api -- critical-rules.e2e-spec.ts` en verde.
- [x] `npm run dev` estable sin locks de `.next` ni procesos huérfanos.
- [x] `npm run qa:secrets:local` ejecutado (JWT locales seguros).
- [x] `npm run qa:email:local` ejecutado (fallback SMTP local).
- [x] `npm run qa:preflight:mvp` ejecutado (sin errores bloqueantes).
- [x] `npm run qa:smoke:mvp` ejecutado y evidencia guardada.
- [x] Runbook manual integrada (sección 10.1) completado y evidenciado.

Evidencia DEV (última ejecución automática):
- Fecha: 2026-02-17
- Comando: `npm run qa:smoke:mvp`
- Resultado: ✅ completado
- Tenant slug: `smoke-tenant-1771382492547`
- Owner: `owner.smoke.1771382492547@example.com`
- Staff: `staff.smoke.1771382492547@example.com`
- Customer: `customer.smoke.1771382492547@example.com`
- Nota: warnings de email esperados por falta de credenciales SendGrid/SMTP en entorno local.

### STAGING
- [ ] Variables `DATABASE_URL`, `REDIS_URL`, `JWT_*`, `NEXT_PUBLIC_API_URL` configuradas.
- [x] `node scripts/mvp-preflight.js --env=staging` en verde.
- [ ] `npm run qa:smoke:staging` en verde.
- [ ] `npm run qa:staging:gate` en verde.
- [x] Simulación local staging: `npm run qa:staging:gate:local`.
- [ ] Credenciales SendGrid/SMTP de staging cargadas.
- [ ] Migraciones Prisma aplicadas (`prisma migrate deploy`).
- [ ] Smoke de flujos críticos: auth, dashboard, reserva pública, cancelación, waitlist.
- [ ] Verificación de auditoría en acciones sensibles (`BOOKING_*`, `TENANT_SETTINGS_UPDATED`).
- [ ] `npm run qa:staging:gate:strict` en verde (sin warnings).
- [x] Simulación local strict sin migraciones: `node scripts/mvp-env-gate.js --env=staging --strict --skip-migrate --smoke-api-url=http://localhost:3001`.
- [x] Smoke widget local: `npm run qa:smoke:widget`.
- [x] Gate widget local: `npm run qa:staging:gate:widget:quick`.
- [x] Release one-click widget local: `npm run qa:release:staging:widget:quick`.
- [x] Release doctor local widget: `npm run qa:release:doctor:staging:widget:local`.

Evidencia STAGING local (última ejecución):
- Fecha: 2026-02-18
- `npm run qa:staging:gate:local`: ✅ completado
- `npm run qa:staging:gate:strict:local`: ✅ completado
- `npm run qa:staging:gate:widget:quick`: ✅ completado
- `npm run qa:release:staging:widget:quick`: ✅ completado
- `npm run qa:release:doctor:staging:widget:local`: ✅ completado
- Estado de preflight staging:
  - `qa:preflight:staging`: ✅ pasa con warnings si `DATABASE_URL`/`REDIS_URL` están en placeholder.
  - `qa:preflight:staging:strict`: ❌ bloquea hasta reemplazar placeholders por valores reales.
- Bloqueo actual para `qa:staging:gate:strict` real: `.env.staging` aún tiene placeholders en `NEXT_PUBLIC_API_URL`, `STAGING_API_URL`, `DATABASE_URL` y `REDIS_URL`; strict no permite avanzar hasta reemplazarlos.

### PROD
- [ ] Secretos productivos validados (sin defaults, rotación definida).
- [x] `node scripts/mvp-preflight.js --env=prod` en verde.
- [ ] `npm run qa:smoke:prod` en verde.
- [ ] `npm run qa:prod:gate` en verde.
- [ ] `npm run qa:prod:gate:strict` en verde (sin warnings).
- [x] Simulación seca prod: `npm run qa:prod:gate:dry`.
- [ ] HTTPS + dominio(s) operativos y redirecciones correctas.
- [ ] Monitoreo/logs y alertas mínimas habilitadas.
- [ ] Backup/restore de base de datos validado.
- [ ] Plan de rollback documentado (última versión estable + migraciones).

---

## 10.4) Comandos operativos consolidados (release)

Selector de comando por escenario:
- `npm run qa:release:help`

Comandos one-click:
- `npm run qa:release:staging` (strict full)
- `npm run qa:release:staging:widget` (strict widget)
- `npm run qa:release:staging:widget:quick` (strict widget local)
- `npm run qa:release:prod` (strict full)
- `npm run qa:release:prod:widget` (strict widget)
- `npm run qa:release:prod:widget:dry` (dry-run widget)

Doctor prerequisitos:
- `npm run qa:release:doctor`
- `npm run qa:release:doctor:staging:widget:local`
- `npm run qa:release:doctor -- --env=staging --mode=widget --scope=local --api-url=http://localhost:3001 --tenant-slug=<slug>`
- `npm run qa:release:doctor -- --env=staging --mode=widget --scope=local --api-url=http://localhost:3001 --tenant-slug=<slug> --failfast`

Runbook operativo detallado:
- `docs/runbooks/domain-widget-release.md`

## 10.5) Plan de ejecución en 7 días (cierre STAGING → preparación PROD)

### Día 1 — Higiene de entorno y secretos
Objetivo:
- Eliminar placeholders de `.env.staging` y validar secretos mínimos.

Tareas:
- Configurar `NEXT_PUBLIC_API_URL`, `STAGING_API_URL`, `DATABASE_URL`, `REDIS_URL` reales.
- Verificar `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` no débiles.
- Confirmar variables de email (SendGrid/SMTP staging).

Comandos:
- `npm run qa:preflight:staging`
- `npm run qa:preflight:staging:strict`

Criterio de salida:
- `qa:preflight:staging:strict` en verde sin warnings bloqueantes.

### Día 2 — Base técnica staging estable
Objetivo:
- Dejar base y migraciones alineadas en staging.

Tareas:
- Aplicar `prisma migrate deploy` en staging.
- Verificar `health` y conectividad DB/Redis.
- Validar que build de `web` y `api` estén limpios en CI/staging.

Comandos:
- `npm run qa:staging:gate -- --skip-smoke`

Criterio de salida:
- Migraciones aplicadas y API saludable.

### Día 3 — Smoke funcional completo
Objetivo:
- Validar flujo funcional end-to-end en staging real.

Tareas:
- Ejecutar smoke full (auth + servicios + staff + reserva).
- Confirmar creación de cita y consistencia de datos multi-tenant.

Comandos:
- `npm run qa:smoke:staging`
- `npm run qa:staging:gate`

Criterio de salida:
- Smoke y gate staging en verde.

### Día 4 — Dominio custom + widget (staging)
Objetivo:
- Cerrar el release de dominio/widget en entorno remoto.

Tareas:
- Configurar tenant real con `customDomain` y `widgetEnabled=true`.
- Validar DNS y TLS del dominio staging.
- Probar snippets (`iframe`, `script src`) en sitio de prueba.

Comandos:
- `npm run qa:release:staging:widget`
- `npm run qa:release:doctor -- --env=staging --mode=widget --scope=remote --tenant-slug=<slug-real> --failfast`

Criterio de salida:
- `widget-config` y `widget.js` respondiendo OK en staging real.

### Día 5 — Notificaciones y observabilidad
Objetivo:
- Verificar comunicaciones reales y señales operativas.

Tareas:
- Ejecutar reserva real y confirmar emails cliente/negocio.
- Validar logs de auditoría para `BOOKING_*` y `TENANT_SETTINGS_UPDATED`.
- Confirmar monitoreo y alertas mínimas activas.

Comandos:
- `npm run qa:staging:gate:strict`

Criterio de salida:
- Notificaciones reales verificadas + auditoría consistente.

### Día 6 — Dry run de producción
Objetivo:
- Preparar release de prod sin ejecutar smoke productivo todavía.

Tareas:
- Revisar secretos y rotación.
- Validar preflight estricto prod.
- Ejecutar gate dry y doctor para escenario widget.

Comandos:
- `npm run qa:prod:gate:dry`
- `npm run qa:release:prod:widget:dry`
- `npm run qa:release:doctor -- --env=prod --mode=widget --scope=dry`

Criterio de salida:
- Todo dry-run productivo en verde.

### Día 7 — Go/No-Go y release controlado
Objetivo:
- Ejecutar decisión final y liberar con plan de rollback listo.

Tareas:
- Revisión final de checklist y riesgos abiertos.
- Ejecutar release productivo full o widget según ventana.
- Registrar evidencia del release (logs, comandos, timestamps, resultado).

Comandos:
- `npm run qa:release:prod` o `npm run qa:release:prod:widget`

Criterio de salida:
- Release en verde + rollback documentado + evidencia archivada.

### Entregables esperados al final de la semana
- STAGING estricto en verde.
- Dominio/widget validado en remoto.
- PROD dry-run en verde.
- Decisión de Go/No-Go sustentada con evidencia.

### Criterio de promoción
- DEV → STAGING: todos los checks de DEV completos.
- STAGING → PROD: smoke + notificaciones + auditoría + migraciones en verde.

---

## 11) Riesgos y Mitigación

- Riesgo: colisiones de horario en alta concurrencia  
  Mitigación: transacciones + lock optimista/pesimista en creación de cita.

- Riesgo: complejidad temprana de integraciones externas  
  Mitigación: desacoplar por adapters y activar en Fase 2/3.

- Riesgo: mezcla de reglas por plan y deuda técnica  
  Mitigación: módulo central de permisos/entitlements desde Sprint 1.

---

## 12) Decisiones Pendientes (Kickoff Técnico)

- [ ] Elegir contrato API principal: REST o tRPC
- [ ] Definir proveedor email inicial: Resend vs SendGrid
- [ ] Definir proveedor hosting backend: Railway vs Render
- [ ] Definir estrategia de facturación: facturas internas vs integración fiscal externa
- [ ] Definir alcance exacto de “reserva por WhatsApp” (link profundo vs flujo conversacional)

---

## 13) Definición de “No olvidar nada” (Control de Ejecución)

Regla operativa del equipo:
1. Ninguna historia se desarrolla sin mapear un ID de requisito (AG/RS/NT/GN/PG/RP/PZ/IN/DF/NFR).  
2. Ningún release se publica sin checklist de fase al 100%.  
3. QA debe validar criterios de aceptación + límites de plan.  
4. Todo cambio sensible debe dejar registro en auditoría.

---

## 14) Próximo Paso Inmediato

Cerrar gate de Go-Live MVP en este orden:
1. Ejecutar y evidenciar runbook manual integrada (10.1).
2. Ejecutar prueba real SendGrid con credenciales válidas.
3. Completar checklist DEV/STAGING/PROD (10.3).
4. Publicar release MVP con rollback definido.

---

*Documento operativo para implementación inicial — listo para ejecución.*
