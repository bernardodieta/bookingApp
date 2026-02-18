# 🚀 SaaS de Gestión de Citas — Documento de Inicio de Implementación

> Basado en: `saas-citas-propuesta.md`  
> Fecha: Febrero 2026  
> Objetivo: iniciar implementación sin omitir requisitos funcionales, técnicos y de negocio.

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
- [ ] **AG-01** Calendario con vista día/semana/mes
- [ ] **AG-02** Disponibilidad configurable por negocio
- [ ] **AG-03** Disponibilidad configurable por empleado
- [ ] **AG-04** Bloqueo de festivos/vacaciones/no disponibilidad
- [ ] **AG-05** Soporte multi-empleado por cuenta
- [ ] **AG-06** Buffer entre citas configurable
- [ ] **AG-07** Límite máximo de reservas por día/semana

### 3.2 Reservas Online (RS)
- [ ] **RS-01** Página pública por negocio (`/slug-negocio`)
- [ ] **RS-02** Flujo de reserva: servicio → empleado → horario → datos
- [ ] **RS-03** Formulario de cliente configurable
- [ ] **RS-04** Reglas de cancelación y reprogramación configurables
- [ ] **RS-05** Lista de espera automática por cupo lleno
- [ ] **RS-06** Reasignación de cupo y notificación al siguiente en lista

### 3.3 Notificaciones (NT)
- [ ] **NT-01** Confirmación inmediata por email
- [ ] **NT-02** Confirmación inmediata por SMS (Pro+)
- [ ] **NT-03** Confirmación inmediata por WhatsApp (Pro+)
- [ ] **NT-04** Recordatorios automáticos configurables (ej. 24h, 2h)
- [ ] **NT-05** Notificación al negocio por nueva/modificada/cancelada

### 3.4 Gestión de Negocio (GN)
- [ ] **GN-01** Catálogo de servicios (nombre, duración, precio)
- [ ] **GN-02** CRM básico (historial, notas, contacto)
- [ ] **GN-03** Panel global de citas del día/semana
- [ ] **GN-04** Política de cancelación (reembolso/crédito/sin devolución)
- [ ] **GN-05** Multi-sede (Business)

### 3.5 Pagos (PG)
- [ ] **PG-01** Pago completo o depósito parcial
- [ ] **PG-02** Integración Stripe
- [ ] **PG-03** Integración MercadoPago
- [ ] **PG-04** Nota de venta/factura básica
- [ ] **PG-05** Política de reembolso configurable
- [ ] **PG-06** Historial de pagos por cliente

### 3.6 Reportes (RP)
- [ ] **RP-01** Dashboard: citas por período
- [ ] **RP-02** Dashboard: ingresos
- [ ] **RP-03** Dashboard: tasa de cancelación
- [ ] **RP-04** Clientes frecuentes
- [ ] **RP-05** Servicios más demandados
- [ ] **RP-06** Horas pico
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
- [ ] **DF-01** Lista de espera automática
- [ ] **DF-02** Reserva por WhatsApp
- [ ] **DF-03** Widget embebible con 1 línea
- [ ] **DF-04** Multi-empleado real (agenda y servicios por empleado)
- [ ] **DF-05** Reseñas post-cita

---

## 4) Requisitos No Funcionales (NFR)

### 4.1 Seguridad
- [ ] **NFR-SEC-01** HTTPS obligatorio
- [ ] **NFR-SEC-02** Rate limit en endpoints públicos
- [ ] **NFR-SEC-03** Validación frontend + backend con Zod
- [ ] **NFR-SEC-04** Aislamiento por tenant con `tenant_id`
- [ ] **NFR-SEC-05** Row-Level Security en PostgreSQL
- [ ] **NFR-SEC-06** Secretos en variables de entorno seguras
- [ ] **NFR-SEC-07** Auditoría de acciones sensibles
- [ ] **NFR-SEC-08** Principios GDPR/privacidad

### 4.2 Escalabilidad y operación
- [ ] **NFR-OPS-01** Cola de jobs para notificaciones y recordatorios
- [ ] **NFR-OPS-02** Caché de disponibilidad
- [ ] **NFR-OPS-03** Multi-tenant sin fuga de datos
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
- [ ] Monorepo/apps + convenciones
- [ ] Setup NestJS + Next.js + Prisma + PostgreSQL
- [ ] Pipeline CI básico (lint, typecheck, test)
- [ ] Gestión de entornos (`.env` por ambiente)
- [ ] Seed de tenant demo

## Sprint 1 (MVP Core)
- [ ] Auth (registro/login/refresh/logout)
- [ ] Multi-tenant (`tenant_id` obligatorio en dominio de datos)
- [ ] CRUD servicios
- [ ] CRUD empleados
- [ ] Configuración disponibilidad
- [ ] Reserva pública paso a paso
- [ ] Confirmación email

## Sprint 2 (MVP Operable)
- [ ] Calendario día/semana/mes en dashboard
- [ ] Reglas cancelación/reprogramación
- [ ] Buffer y límites de reserva
- [ ] Panel diario/semanal de citas
- [ ] Lista de espera básica
- [ ] Hardening seguridad (rate limit + auditoría)

---

## 9) Criterios de Aceptación de MVP (Go-Live)

El MVP está listo solo si:
- [ ] Un negocio puede registrarse y crear su configuración básica
- [ ] Puede publicar su página de reservas por slug
- [ ] Un cliente puede reservar de inicio a fin sin intervención humana
- [ ] El negocio recibe notificación por nueva reserva
- [ ] El cliente recibe confirmación por email
- [ ] No hay acceso cruzado de datos entre tenants
- [ ] Se respetan límites del plan Free (usuario y citas/mes)
- [ ] Existe trazabilidad básica de auditoría

---

## 10) QA y Pruebas Mínimas Obligatorias

- [ ] Unit tests en reglas de disponibilidad y colisión de horarios
- [ ] Unit tests en políticas de cancelación/reprogramación
- [ ] Integration tests en flujo de reserva (API)
- [ ] E2E smoke test: registro negocio → crear servicio → reservar
- [ ] Test multi-tenant: aislamiento estricto por `tenant_id`

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

Iniciar **Sprint 0** y abrir épicas en el gestor de tareas con esta estructura:
- Épica 1: Fundaciones técnicas
- Épica 2: Reserva pública MVP
- Épica 3: Operación de agenda y notificaciones
- Épica 4: Seguridad multi-tenant y compliance base

---

*Documento operativo para implementación inicial — listo para ejecución.*
