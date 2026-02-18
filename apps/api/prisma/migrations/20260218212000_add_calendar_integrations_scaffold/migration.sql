CREATE TYPE "CalendarProvider" AS ENUM ('google', 'microsoft');
CREATE TYPE "CalendarAccountStatus" AS ENUM ('connected', 'error', 'disconnected');
CREATE TYPE "CalendarSyncStatus" AS ENUM ('pending', 'synced', 'conflict', 'failed');

CREATE TABLE "CalendarAccount" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "provider" "CalendarProvider" NOT NULL,
  "externalAccountId" TEXT NOT NULL,
  "calendarId" TEXT NOT NULL,
  "accessTokenEncrypted" TEXT NOT NULL,
  "refreshTokenEncrypted" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "status" "CalendarAccountStatus" NOT NULL DEFAULT 'connected',
  "syncCursor" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarEventLink" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "provider" "CalendarProvider" NOT NULL,
  "externalEventId" TEXT NOT NULL,
  "externalICalUID" TEXT,
  "lastExternalVersion" TEXT,
  "syncStatus" "CalendarSyncStatus" NOT NULL DEFAULT 'pending',
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarEventLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CalendarAccount_tenantId_idx" ON "CalendarAccount"("tenantId");
CREATE INDEX "CalendarAccount_staffId_idx" ON "CalendarAccount"("staffId");
CREATE INDEX "CalendarAccount_provider_status_idx" ON "CalendarAccount"("provider", "status");
CREATE UNIQUE INDEX "CalendarAccount_tenantId_provider_staffId_calendarId_key" ON "CalendarAccount"("tenantId", "provider", "staffId", "calendarId");

CREATE INDEX "CalendarEventLink_tenantId_idx" ON "CalendarEventLink"("tenantId");
CREATE INDEX "CalendarEventLink_bookingId_idx" ON "CalendarEventLink"("bookingId");
CREATE INDEX "CalendarEventLink_accountId_idx" ON "CalendarEventLink"("accountId");
CREATE INDEX "CalendarEventLink_provider_syncStatus_idx" ON "CalendarEventLink"("provider", "syncStatus");
CREATE UNIQUE INDEX "CalendarEventLink_tenantId_bookingId_accountId_key" ON "CalendarEventLink"("tenantId", "bookingId", "accountId");
CREATE UNIQUE INDEX "CalendarEventLink_accountId_provider_externalEventId_key" ON "CalendarEventLink"("accountId", "provider", "externalEventId");

ALTER TABLE "CalendarAccount"
  ADD CONSTRAINT "CalendarAccount_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarAccount"
  ADD CONSTRAINT "CalendarAccount_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarEventLink"
  ADD CONSTRAINT "CalendarEventLink_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarEventLink"
  ADD CONSTRAINT "CalendarEventLink_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarEventLink"
  ADD CONSTRAINT "CalendarEventLink_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "CalendarAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
