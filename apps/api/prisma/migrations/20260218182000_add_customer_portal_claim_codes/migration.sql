-- CreateTable
CREATE TABLE "CustomerPortalClaimCode" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPortalClaimCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerPortalClaimCode_tenantId_accountId_createdAt_idx" ON "CustomerPortalClaimCode"("tenantId", "accountId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerPortalClaimCode_tenantId_expiresAt_idx" ON "CustomerPortalClaimCode"("tenantId", "expiresAt");

-- AddForeignKey
ALTER TABLE "CustomerPortalClaimCode" ADD CONSTRAINT "CustomerPortalClaimCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPortalClaimCode" ADD CONSTRAINT "CustomerPortalClaimCode_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
