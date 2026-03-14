# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Apoint App is a multi-tenant SaaS appointment booking platform. Monorepo with npm workspaces containing a NestJS API backend and Next.js frontend.

- **Language**: TypeScript 5.5
- **Backend**: NestJS 10 (`apps/api/`, port 3001)
- **Frontend**: Next.js 14 with App Router (`apps/web/`, port 3000)
- **Database**: PostgreSQL 16 via Prisma 5 ORM
- **Infrastructure**: Docker Compose (PostgreSQL, Redis, Mailpit)

## Common Commands

```bash
# Development
npm run dev                  # Start both web + API (runs dev:prep first)
npm run dev:api              # API only
npm run dev:web              # Web only
npm run dev:reset:win        # Kill stuck Node processes (Windows)

# Build & Lint
npm run build                # Build both
npm run lint                 # Lint both
npm run typecheck            # Type-check both

# Database (Prisma)
npx prisma generate --schema apps/api/prisma/schema.prisma
npx prisma migrate dev --schema apps/api/prisma/schema.prisma --name <migration_name>
npm run seed:demo -w @apoint/api    # Creates demo tenant (owner@demo.com / Password123)

# Infrastructure
docker compose up -d postgres redis
npm run qa:email:local               # Configure local SMTP fallback
docker compose up -d mailpit         # Local email UI at localhost:8025

# Tests (API)
npm run test -w @apoint/api          # Unit tests (Jest)
npm run test:unit -w @apoint/api     # Explicit unit tests
npm run test:e2e -w @apoint/api      # E2E tests

# QA / Release
npm run qa:preflight:mvp             # Validate minimal env config
npm run qa:smoke:mvp                 # Smoke tests against local API
npm run qa:release:doctor            # Check release prerequisites
npm run qa:release:help              # Show recommended release command
```

## Architecture

### Multi-Tenancy

All data is isolated by `tenantId`. Every query in every service must filter by tenant. The `AuthUser` type carries `sub`, `tenantId`, `email`, `role`, and optional `staffId`.

### Plan Limits

- **free**: max 1 staff, 50 bookings/month
- **pro**: max 5 staff, unlimited bookings
- **business**: unlimited

### Backend Pattern: Module → Controller → Service → Prisma

Each feature is a NestJS module in `apps/api/src/`. Key modules: `auth`, `bookings`, `services`, `staff`, `availability`, `payments`, `notifications`, `integrations`, `customers`, `dashboard`, `public`, `customer-portal`, `tenant-settings`, `audit`, `admin`.

- **Guards**: `AuthGuard` (JWT validation), `RolesGuard` in `common/guards/`
- **DTOs**: Validated with `class-validator` + `class-transformer`; global `ValidationPipe` with whitelist + transform
- **Public routes**: `/public/:slug/*` endpoints require no auth; rate-limited via `RateLimitMiddleware`
- **Raw body**: Enabled on main.ts for Stripe webhook signature verification

### Authentication

JWT Bearer tokens. Three auth methods: email/password, Google OAuth (`/auth/google`), and customer portal Google login. Tokens stored in frontend `localStorage` under `apoint.dashboard.*` keys.

### Payments

Stripe integration with checkout sessions, webhook confirmation (`Stripe-Signature`), and idempotency. Manual payment recording also supported. Refund policy configurable per tenant (`none`/`credit`/`full`).

### Calendar Integrations

Google Calendar and Microsoft Calendar OAuth. Tokens encrypted at rest (`CALENDAR_TOKENS_ENCRYPTION_KEY`). Outbound sync via `CalendarSyncJob` queue with retries/backoff. Inbound sync via webhooks with incremental pull (`syncToken`/`deltaLink`). Conflicts tracked and resolvable through dashboard.

### Notifications

Dual-channel email: SendGrid primary, Nodemailer SMTP fallback. Automatic reminder scheduler runs every 5 min (configurable via `REMINDERS_AUTO_ENABLED` and `REMINDERS_RUN_INTERVAL_MS`).

### Frontend

Next.js App Router with client components. Key routes:
- `/login` — Auth page
- `/dashboard` — Owner/admin dashboard
- `/staff-dashboard` — Staff portal
- `/public/:slug` — Public booking portal
- `/admin` — Admin pages

Custom domain support via `middleware.ts` which rewrites requests to `/public/{hostname}{path}`.

### Database Schema

Prisma schema at `apps/api/prisma/schema.prisma`. Key models: `Tenant`, `User`, `Staff`, `Service`, `AvailabilityRule`, `AvailabilityException`, `Booking`, `Customer`, `Payment`, `WaitlistEntry`, `CalendarAccount`, `CalendarEventLink`, `CalendarSyncJob`, `AuditLog`.

### Environment

Config via `.env` (local), `.env.staging`, `.env.prod`. Use `.env.example` as template. Validate with `npm run qa:preflight:*` scripts. Generate JWT secrets with `npm run qa:secrets:local`.

## Key Conventions

- **Validation**: Zod on frontend forms, `class-validator` + `class-transformer` DTOs on backend
- **DateTime**: Luxon (`luxon`) for all date/time handling in the API
- **Email**: SendGrid primary, Nodemailer SMTP fallback
- **State management**: No global store — React hooks + localStorage. Direct fetch calls to API.
- **Custom domains**: Middleware detects custom domain from request header and rewrites to `/public/{hostname}`

## Environment Setup

Copy `.env.example` to `.env`. Key variables: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_CUSTOMER_SECRET`, `GOOGLE_CLIENT_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CALENDAR_TOKENS_ENCRYPTION_KEY`.

Use `npm run qa:secrets:local` to generate/rotate local JWT secrets and `npm run qa:email:local` to configure local SMTP.

## CI

GitHub Actions (`.github/workflows/ci.yml`): Node 20 → install → lint → build. Runs on push/PR to main.
