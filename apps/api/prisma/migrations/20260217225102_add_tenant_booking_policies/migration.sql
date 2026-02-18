-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "bookingBufferMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cancellationNoticeHours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxBookingsPerDay" INTEGER,
ADD COLUMN     "maxBookingsPerWeek" INTEGER,
ADD COLUMN     "rescheduleNoticeHours" INTEGER NOT NULL DEFAULT 0;
