-- Additive only: permanent placement fee terms (fee type, salary, percentage / fixed fee, placement date, invoice number and date) on fees, and when commission on a permanent placement is earned.
-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "CommissionTrigger" AS ENUM ('PLACEMENT', 'PAID');

-- AlterTable
ALTER TABLE "fees" ADD COLUMN     "annualSalary" DECIMAL(12,2),
ADD COLUMN     "feePercent" DECIMAL(5,2),
ADD COLUMN     "feeType" "FeeType",
ADD COLUMN     "fixedFee" DECIMAL(12,2),
ADD COLUMN     "invoiceDate" TIMESTAMP(3),
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "placementDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "organisations" ADD COLUMN     "permanentCommissionTrigger" "CommissionTrigger" NOT NULL DEFAULT 'PLACEMENT';

