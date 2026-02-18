# 🚀 SaaS de Gestión de Citas — Documento de Inicio de Implementación

> Basado en: `saas-citas-propuesta.md`  
> Fecha: Febrero 2026  
> Objetivo: iniciar implementación sin omitir requisitos funcionales, técnicos y de negocio.

## Estado actual (actualizado 2026-02-17)

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
- Suite e2e crítica pasando (17/17).

Pendiente inmediato para cierre de go-live MVP:
- Prueba manual integrada dashboard → public/:slug → reserva (checklist abajo).
- Validación real de proveedor SendGrid con credenciales reales (cuando se habiliten).

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
- [ ] **PZ-01** Logo + colores en página pública
- [ ] **PZ-02** Mensajes personalizados en emails/confirmaciones
- [ ] **PZ-03** Idioma configurable
- [ ] **PZ-04** Zona horaria configurable
- [ ] **PZ-05** Dominio personalizado (Business)
- [ ] **PZ-06** Widget embebible

### 3.8 Integraciones (IN)
- [ ] **IN-01** Google Calendar bidireccional
- [ ] **IN-02** Outlook Calendar bidireccional
- [ ] **IN-03** Google Meet auto-link en cita virtual
- [ ] **IN-04** Zoom auto-link en cita virtual
- [ ] **IN-05** WhatsApp Business
- [ ] **IN-06** Reserva desde Instagram/Facebook
- [ ] **IN-07** Zapier

### 3.9 Diferenciadores (DF)
- [x] **DF-01** Lista de espera automática
- [ ] **DF-02** Reserva por WhatsApp
- [ ] **DF-03** Widget embebible con 1 línea
- [ ] **DF-04** Multi-empleado real (agenda y servicios por empleado)
- [ ] **DF-05** Reseñas post-cita

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

Evidencia STAGING local (última ejecución):
- Fecha: 2026-02-17
- `npm run qa:staging:gate:local`: ✅ completado
- `node scripts/mvp-env-gate.js --env=staging --strict --skip-migrate --smoke-api-url=http://localhost:3001`: ✅ completado
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
