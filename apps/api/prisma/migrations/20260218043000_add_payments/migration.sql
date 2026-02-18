-- Create enums for payments domain
CREATE TYPE "PaymentKind" AS ENUM ('full', 'deposit', 'refund');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'card', 'transfer', 'link', 'stripe', 'mercadopago');
CREATE TYPE "PaymentProvider" AS ENUM ('manual', 'stripe', 'mercadopago');

-- Create payments table
CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "customerId" TEXT,
  "kind" "PaymentKind" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'paid',
  "method" "PaymentMethod" NOT NULL DEFAULT 'cash',
  "provider" "PaymentProvider" NOT NULL DEFAULT 'manual',
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'MXN',
  "providerReference" TEXT,
  "notes" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");
CREATE INDEX "Payment_tenantId_createdAt_idx" ON "Payment"("tenantId", "createdAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
