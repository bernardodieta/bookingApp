-- Add configurable reminder window per tenant (hours before appointment)
ALTER TABLE "Tenant"
ADD COLUMN "reminderHoursBefore" INTEGER NOT NULL DEFAULT 24;
