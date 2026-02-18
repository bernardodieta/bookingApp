# SaaS Citas — Resumen Ejecutivo

Fecha: 2026-02-18

## Estado General

Implementación en estado **operable local** y preparada para transición controlada a staging/prod.

El producto ya cubre flujo core de negocio:
- registro y autenticación,
- configuración operativa (servicios, staff, disponibilidad),
- reservas públicas end-to-end,
- recordatorios y notificaciones,
- dashboard de operación y reportes,
- pagos Stripe en MVP,
- personalización por tenant (branding, idioma base, zona horaria),
- dominio personalizado + widget embebible.

## Logros Clave Completados

1. **Core MVP funcional**
- Flujo completo dashboard → página pública → reserva.
- Validación de formulario configurable por tenant.
- Lista de espera y reglas de cancelación/reprogramación.

2. **Control multi-tenant y seguridad base**
- Aislamiento por tenant aplicado.
- Auditoría de eventos sensibles.
- Rate limiting en rutas críticas.

3. **Operación comercial inicial**
- Configuración por tenant: `logoUrl`, `primaryColor`, `timeZone`, `locale`.
- Dominio custom (`customDomain`) y `widgetEnabled`.
- Endpoints de widget: `widget-config` y `widget.js`.

4. **Madurez de release/QA**
- Smoke y gate por entorno (full + widget-only).
- Comandos one-click de release.
- `qa:release:help` para selección guiada de comando.
- `qa:release:doctor` con chequeos de prerequisitos y validación tenant/widget.

## Riesgos Pendientes (no bloqueantes locales, sí para go-live real)

- Variables staging/prod aún con placeholders en algunos entornos.
- Falta validación real de proveedor transaccional (SendGrid) con credenciales productivas.
- Falta validación final de DNS/TLS en dominio de cliente real.
- Algunas capacidades de fases posteriores siguen pendientes (SMS/WhatsApp, MercadoPago, exportaciones, integraciones externas, multi-sede).

## Decisión Recomendada

Pasar a **etapa de hardening de staging** y luego a **piloto controlado**:

1. Completar secretos y URLs reales de staging/prod.
2. Ejecutar:
   - `npm run qa:release:staging:widget`
   - `npm run qa:release:doctor -- --env=staging --mode=widget --scope=remote --tenant-slug=<slug-real>`
3. Validar reserva real + notificaciones en dominio custom.
4. Aprobar salida a prod con `qa:release:prod:widget`.

## Comandos Ejecutivos (rápidos)

- Selector: `npm run qa:release:help`
- Staging widget local: `npm run qa:release:staging:widget:quick`
- Staging widget remoto: `npm run qa:release:staging:widget`
- Prod widget remoto: `npm run qa:release:prod:widget`
- Doctor local widget: `npm run qa:release:doctor:staging:widget:local`

## Referencias

- Implementación detallada: `saas-citas-implementacion.md`
- Propuesta funcional/comercial: `saas-citas-propuesta.md`
- Runbook dominio/widget: `docs/runbooks/domain-widget-release.md`
