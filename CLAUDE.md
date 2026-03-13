# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Apoint is a multi-tenant SaaS booking/appointment platform. It's an npm workspace monorepo with:
- `apps/web` — Next.js 14 frontend (App Router, React 18, Tailwind CSS, TypeScript)
- `apps/api` — NestJS 10 backend (REST API, Prisma ORM, PostgreSQL)
- `packages/config` — shared configuration (placeholder)

## Common Commands

```bash
# Development
npm run dev              # Run both web (port 3000) and api (port 3001) concurrently
npm run dev:web          # Web only
npm run dev:api          # API only

# Infrastructure (Docker)
docker compose up -d postgres redis    # PostgreSQL on :55432, Redis on :6379
docker compose up -d mailpit           # Local SMTP mock (UI at :8025)

# Build & Lint
npm run build            # Build both apps
npm run lint             # Lint both apps
npm run typecheck        # Typecheck web (tsc --noEmit) + build api

# Database (Prisma)
npx prisma generate --schema apps/api/prisma/schema.prisma
npx prisma migrate dev --schema apps/api/prisma/schema.prisma --name <name>
npm run seed:demo -w @apoint/api       # Creates demo tenant (owner@demo.com / Password123)

# Testing (API)
npm run test -w @apoint/api            # Unit tests (jest)
npm run test:unit -w @apoint/api       # Unit tests
npm run test:e2e -w @apoint/api        # E2E tests (jest --config ./test/jest-e2e.json)

# QA & Release
npm run qa:preflight:mvp               # Validate minimum env config
npm run qa:smoke:mvp                   # Smoke test against local API
npm run qa:release:help                # Show recommended release command per scenario
npm run qa:release:doctor              # Verify release prerequisites
```

## Architecture

### Multi-Tenancy
Every data model hangs off a `Tenant`. The JWT token carries `{ sub, tenantId, email, role, staffId? }` and guards enforce tenant isolation on all protected routes. There is no cross-tenant data access.

### Authentication (3 tracks)
1. **Email/Password** — `POST /auth/register` (creates Tenant + User), `POST /auth/login`
2. **Google OAuth** — `POST /auth/google` (existing users only, verified via `google-auth-library`)
3. **Staff Registration** — `POST /auth/staff/register` (invited staff sets password, links User to Staff)

Token stored in frontend localStorage as `apoint.dashboard.token`. Access token expires in 2h.

### Backend (NestJS) Module Map
Key modules: `auth`, `services`, `staff`, `availability`, `bookings`, `customers`, `payments`, `integrations` (calendar OAuth + sync), `public` (unauthenticated booking flow by slug/domain), `dashboard` (KPI reporting), `audit`, `tenant-settings`, `customer-portal`, `admin`.

### Frontend (Next.js App Router) Routes
- `/login` — dashboard login
- `/dashboard` — main protected dashboard (sections: overview, agenda, payments, operations, settings, audit, integrations, staff)
- `/public/[slug]` — public booking portal per tenant
- `/staff-dashboard` — staff-specific view
- `/admin` — multi-tenant admin (secret-gated)

### Database
PostgreSQL via Prisma. Schema at `apps/api/prisma/schema.prisma`. Key model hierarchy:
```
Tenant → User, Service, Staff, AvailabilityRule/Exception, Booking, Customer,
         Payment, CalendarAccount, CalendarSyncJob, WaitlistEntry, AuditLog, TenantSettings
```

### Calendar Integrations
Google & Microsoft OAuth with encrypted token storage. Bidirectional sync via async job queue (`CalendarSyncJob`). Webhook-driven inbound sync. Conflict detection with manual resolution UI.

### Payments
Stripe integration (checkout sessions, signed webhooks). Manual payment recording (cash/card/transfer/link). Configurable refund policy per tenant: `full`, `credit`, `none`.

### Plan Limits
- `free`: 1 staff, 50 bookings/month
- `pro`: 5 staff, unlimited bookings
- `business`: unlimited

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
