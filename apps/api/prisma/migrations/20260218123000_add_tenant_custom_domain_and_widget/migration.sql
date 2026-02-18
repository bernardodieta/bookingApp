-- AlterTable
ALTER TABLE "Tenant"
ADD COLUMN "customDomain" TEXT,
ADD COLUMN "widgetEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_customDomain_key" ON "Tenant"("customDomain");
