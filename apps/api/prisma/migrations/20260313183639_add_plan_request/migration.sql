-- CreateEnum
CREATE TYPE "PlanRequestStatus" AS ENUM ('pending', 'contacted', 'converted', 'rejected');

-- CreateTable
CREATE TABLE "PlanRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "businessName" TEXT NOT NULL,
    "requestedPlan" "Plan" NOT NULL,
    "message" TEXT,
    "status" "PlanRequestStatus" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "PlanRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanRequest_status_idx" ON "PlanRequest"("status");

-- CreateIndex
CREATE INDEX "PlanRequest_createdAt_idx" ON "PlanRequest"("createdAt");
