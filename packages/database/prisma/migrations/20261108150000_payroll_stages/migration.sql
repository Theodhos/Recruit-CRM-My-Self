-- Additive only: the "checked" step of a timesheet, "payslip issued", and the client invoicing settings (CIS deducted by the client, VAT rate, reverse charge) with defaults 0% / 20% / off.
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TimesheetEventAction" ADD VALUE 'CHECKED';
ALTER TYPE "TimesheetEventAction" ADD VALUE 'PAYSLIP_ISSUED';

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "cisDeductionRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
ADD COLUMN     "vatReverseCharge" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payslips" ADD COLUMN     "issuedAt" TIMESTAMP(3),
ADD COLUMN     "issuedById" TEXT;

-- AlterTable
ALTER TABLE "timesheets" ADD COLUMN     "checkedAt" TIMESTAMP(3),
ADD COLUMN     "checkedById" TEXT;

