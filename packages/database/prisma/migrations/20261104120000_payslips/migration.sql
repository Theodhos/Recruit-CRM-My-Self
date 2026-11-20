-- Pagesat (Payslips): weekly CIS payslips.
CREATE TYPE "PayslipRateType" AS ENUM ('DAY', 'HOUR');

CREATE TABLE "payslips" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "nino" TEXT,
    "utr" TEXT,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "rateType" "PayslipRateType" NOT NULL DEFAULT 'DAY',
    "rate" DECIMAL(12,2) NOT NULL,
    "quantity" DECIMAL(8,2) NOT NULL,
    "gross" DECIMAL(12,2) NOT NULL,
    "cisRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "cisDeduction" DECIMAL(12,2) NOT NULL,
    "payrollFee" DECIMAL(12,2) NOT NULL DEFAULT 15,
    "netPay" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payslips_organisationId_idx" ON "payslips"("organisationId");
CREATE INDEX "payslips_organisationId_paymentDate_idx" ON "payslips"("organisationId", "paymentDate");

ALTER TABLE "payslips" ADD CONSTRAINT "payslips_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
