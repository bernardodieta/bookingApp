-- Add refund policy configuration per tenant
CREATE TYPE "RefundPolicy" AS ENUM ('full', 'credit', 'none');

ALTER TABLE "Tenant"
ADD COLUMN "refundPolicy" "RefundPolicy" NOT NULL DEFAULT 'none';
