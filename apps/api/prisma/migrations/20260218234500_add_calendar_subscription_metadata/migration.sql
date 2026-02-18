ALTER TABLE "CalendarAccount"
  ADD COLUMN "webhookSubscriptionId" TEXT,
  ADD COLUMN "webhookResourceId" TEXT,
  ADD COLUMN "webhookExpiresAt" TIMESTAMP(3);

CREATE INDEX "CalendarAccount_provider_webhookExpiresAt_idx"
  ON "CalendarAccount"("provider", "webhookExpiresAt");
