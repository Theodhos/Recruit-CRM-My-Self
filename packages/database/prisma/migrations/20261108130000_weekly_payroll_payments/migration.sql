-- Additive only: payment tracking on payslips (awaiting authorisation / authorised / paid) and three more history events. Payslips that already exist are recorded as PAID, because they are records of payments made.
-- CreateEnum
CREATE TYPE "PayslipPaymentStatus" AS ENUM ('UNPAID', 'AUTHORISED', 'PAID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TimesheetEventAction" ADD VALUE 'PAYMENT_AUTHORISED';
ALTER TYPE "TimesheetEventAction" ADD VALUE 'PAYMENT_REVERSED';
ALTER TYPE "TimesheetEventAction" ADD VALUE 'PAID';

-- AlterTable
ALTER TABLE "payslips" ADD COLUMN     "authorisedAt" TIMESTAMP(3),
ADD COLUMN     "authorisedById" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidById" TEXT,
ADD COLUMN     "paymentReference" TEXT,
ADD COLUMN     "paymentStatus" "PayslipPaymentStatus" NOT NULL DEFAULT 'PAID';

