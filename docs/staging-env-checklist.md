# Staging env checklist (MVP gate strict)

Completa estos valores en `.env.staging` con datos reales del entorno staging.

## Variables críticas (bloqueantes)

- `NEXT_PUBLIC_API_URL`
  - Formato: `https://<dominio-api-staging>`
  - Ejemplo válido: `https://api-staging.tu-dominio.com`
- `STAGING_API_URL`
  - Debe apuntar al mismo backend de staging usado por smoke
  - Formato: `https://<dominio-api-staging>`
- `DATABASE_URL`
  - Formato Prisma/Postgres:
  - `postgresql://<user>:<password>@<host>:<port>/<database>?schema=public`
- `REDIS_URL`
  - Formato: `redis://<host>:<port>` o `rediss://<host>:<port>`

## Variables de seguridad

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

Recomendación: secretos aleatorios >= 32 caracteres.

## Variables de notificaciones

Configura al menos un proveedor completo:

### Opción A: SendGrid
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`

### Opción B: SMTP
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_FROM_EMAIL` (o `SMTP_USER`)
- `SMTP_SECURE` (`true|false`)
- `SMTP_USER`/`SMTP_PASS` (según proveedor)

## Verificación rápida

1. `npm run qa:preflight:staging`
2. `npm run qa:preflight:staging:strict`
3. `npm run qa:staging:gate:strict`

Si `strict` falla, corregir variables reportadas y repetir.

## Atajo local para continuar desarrollo (sin secretos reales)

Cuando solo quieras validar flujo técnico local y todavía no tengas secretos/endpoints reales de staging:

`npm run qa:staging:gate:strict:local`

Este modo convierte placeholders de staging en `info` (solo local) y mantiene el smoke end-to-end.
