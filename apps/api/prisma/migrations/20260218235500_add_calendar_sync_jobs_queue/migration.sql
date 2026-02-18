CREATE TYPE "CalendarSyncJobStatus" AS ENUM ('pending', 'processing', 'succeeded', 'dead_letter');

CREATE TABLE "CalendarSyncJob" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "provider" "CalendarProvider" NOT NULL,
  "action" TEXT NOT NULL,
  "status" "CalendarSyncJobStatus" NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarSyncJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CalendarSyncJob_status_nextRunAt_idx" ON "CalendarSyncJob"("status", "nextRunAt");
CREATE INDEX "CalendarSyncJob_tenantId_status_nextRunAt_idx" ON "CalendarSyncJob"("tenantId", "status", "nextRunAt");
CREATE INDEX "CalendarSyncJob_bookingId_idx" ON "CalendarSyncJob"("bookingId");

ALTER TABLE "CalendarSyncJob"
  ADD CONSTRAINT "CalendarSyncJob_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarSyncJob"
  ADD CONSTRAINT "CalendarSyncJob_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
