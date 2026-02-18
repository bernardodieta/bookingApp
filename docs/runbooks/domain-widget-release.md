# Runbook — Release Dominio + Widget

## Objetivo

Estandarizar release, validación y rollback de funcionalidades de dominio personalizado y widget embebible.

## Pre-checks

- `customDomain` configurado y `widgetEnabled=true` en el tenant objetivo.
- DNS del dominio apuntando al frontend (CNAME/A) y propagado.
- TLS/SSL activo en edge (Cloudflare/Vercel/etc).
- Variables de entorno de API/Web cargadas para el entorno objetivo.

## Comandos recomendados

### One-click release

- Staging full: `npm run qa:release:staging`
- Staging widget: `npm run qa:release:staging:widget`
- Staging widget quick (local): `npm run qa:release:staging:widget:quick`
- Producción full: `npm run qa:release:prod`
- Producción widget: `npm run qa:release:prod:widget`
- Producción widget dry: `npm run qa:release:prod:widget:dry`

### Selector automático de comando

Puedes pedir recomendación por escenario con:

- `npm run qa:release:help`
- `npm run qa:release:help -- --env=staging --mode=widget --scope=local`
- `npm run qa:release:help -- --env=prod --mode=widget --scope=dry`

### Doctor de prerequisitos

- `npm run qa:release:doctor`
- `npm run qa:release:doctor:staging:widget:local`
- `npm run qa:release:doctor -- --env=staging --mode=widget --scope=local --api-url=http://localhost:3001 --tenant-slug=mi-slug`
- `npm run qa:release:doctor:failfast`

El doctor valida Node.js, archivos de entorno, servicios Docker (en scope local), salud de API, comando recomendado por escenario y (opcionalmente) que el tenant tenga `widgetEnabled=true`, `customDomain` configurado y endpoints `widget-config` + `widget.js` operativos.

### Staging

- Gate completo: `npm run qa:staging:gate`
- Gate widget: `npm run qa:staging:gate:widget`
- Local rápido (sin migración): `npm run qa:staging:gate:widget:quick`

### Producción

- Gate completo: `npm run qa:prod:gate`
- Gate widget: `npm run qa:prod:gate:widget`
- Dry run widget: `npm run qa:prod:gate:widget:dry`

## Verificación manual mínima

- Abrir dominio custom y confirmar render de página pública en `/`.
- Probar endpoint `GET /public/:slugOrDomain/widget-config`.
- Probar endpoint `GET /public/:slugOrDomain/widget.js`.
- Insertar snippet recomendado en una página externa de prueba:

```html
<script src="https://api.tu-dominio.com/public/slug-o-dominio/widget.js" defer></script>
<button data-apoint-book type="button">Reservar cita</button>
```

- Crear una reserva real de prueba y validar notificaciones.

## Criterios de salida

- Gate y smoke sin errores bloqueantes.
- Smoke widget exitoso.
- Reserva end-to-end confirmada en dominio custom.
- Evidencia guardada (logs + captura de pantalla).

## Incidentes frecuentes y respuesta

### 1) El dominio custom abre 404 o página incorrecta

- Revisar DNS (host correcto, sin typo, propagación).
- Confirmar middleware de web activo y deploy actualizado.
- Confirmar `customDomain` exacto en tenant settings.
- Mitigación temporal: compartir URL por slug (`/public/:slug`).

### 2) `widget.js` responde 404

- Confirmar `widgetEnabled=true`.
- Validar que el slug/dominio exista y pertenezca al tenant.
- Revisar logs de API para `NotFoundException` en `widget.js`.
- Mitigación temporal: usar snippet `iframe` directo al booking URL.

### 3) Popup bloqueado por navegador

- Verificar que el botón dispare evento de click usuario (no auto-open).
- Probar fallback con enlace `<a target="_blank">`.

## Rollback rápido

1. Desactivar widget en settings (`widgetEnabled=false`).
2. Quitar snippet embebido del sitio externo del cliente.
3. Si hay falla de dominio, limpiar `customDomain` y volver a URL slug.
4. Re-ejecutar smoke mínimo (`qa:smoke:widget`) para confirmar estado estable.

## Comando de emergencia local

Cuando `npm run ... -- --flags` no pase flags como esperas, ejecutar directo:

`node scripts/mvp-env-gate.js --env=staging --smoke-mode=widget --skip-migrate --smoke-api-url=http://localhost:3001`
