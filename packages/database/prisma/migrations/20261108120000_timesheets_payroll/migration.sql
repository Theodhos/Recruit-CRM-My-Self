-- Additive only: weekly timesheets of temporary workers, their approval history, worker payroll details, and the payroll:approve permission (administrators only).
-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TimesheetEventAction" AS ENUM ('SUBMITTED', 'AMENDED', 'RESUBMITTED', 'APPROVED', 'REJECTED', 'PAYSLIP_GENERATED');

-- AlterTable
ALTER TABLE "payslips" ADD COLUMN     "candidateId" TEXT,
ADD COLUMN     "timesheetId" TEXT;

-- CreateTable
CREATE TABLE "worker_payroll_profiles" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "nino" TEXT,
    "utr" TEXT,
    "cisRate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "payrollFee" DECIMAL(12,2) NOT NULL DEFAULT 15,
    "rateType" "PayslipRateType" NOT NULL DEFAULT 'DAY',
    "payRate" DECIMAL(12,2),
    "chargeRate" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worker_payroll_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheets" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "placementId" TEXT,
    "jobId" TEXT,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "rateType" "PayslipRateType" NOT NULL DEFAULT 'DAY',
    "payRate" DECIMAL(12,2) NOT NULL,
    "chargeRate" DECIMAL(12,2) NOT NULL,
    "days" JSONB NOT NULL,
    "totalUnits" DECIMAL(8,2) NOT NULL,
    "gross" DECIMAL(12,2) NOT NULL,
    "cisRate" DECIMAL(5,2) NOT NULL,
    "cisDeduction" DECIMAL(12,2) NOT NULL,
    "payrollFee" DECIMAL(12,2) NOT NULL,
    "netPay" DECIMAL(12,2) NOT NULL,
    "chargeTotal" DECIMAL(12,2) NOT NULL,
    "profit" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "clientConfirmedBy" TEXT,
    "clientConfirmedEmail" TEXT,
    "clientConfirmedAt" TIMESTAMP(3),
    "attachmentDocumentId" TEXT,
    "notes" TEXT,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_events" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "action" "TimesheetEventAction" NOT NULL,
    "userId" TEXT,
    "note" TEXT,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheet_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "worker_payroll_profiles_organisationId_candidateId_key" ON "worker_payroll_profiles"("organisationId", "candidateId");

-- CreateIndex
CREATE INDEX "timesheets_organisationId_weekStart_idx" ON "timesheets"("organisationId", "weekStart");

-- CreateIndex
CREATE INDEX "timesheets_organisationId_status_idx" ON "timesheets"("organisationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "timesheets_organisationId_candidateId_companyId_weekStart_key" ON "timesheets"("organisationId", "candidateId", "companyId", "weekStart");

-- CreateIndex
CREATE INDEX "timesheet_events_timesheetId_createdAt_idx" ON "timesheet_events"("timesheetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_timesheetId_key" ON "payslips"("timesheetId");

-- AddForeignKey
ALTER TABLE "worker_payroll_profiles" ADD CONSTRAINT "worker_payroll_profiles_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_payroll_profiles" ADD CONSTRAINT "worker_payroll_profiles_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_events" ADD CONSTRAINT "timesheet_events_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_events" ADD CONSTRAINT "timesheet_events_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Only people who manage users (administrators) may approve payroll; an administrator can still change this per role.
INSERT INTO "permissions" ("id", "key", "module", "description", "createdAt") VALUES
  ('perm_payroll_approve', 'payroll:approve', 'payroll', 'Approve or reject weekly timesheets and generate payslips', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'rp_pay_' || substr(md5(rp."roleId" || p."id"), 1, 20), rp."roleId", p."id", CURRENT_TIMESTAMP
FROM "role_permissions" rp
JOIN "permissions" src ON src."id" = rp."permissionId" AND src."key" = 'users:manage'
JOIN "permissions" p ON p."key" = 'payroll:approve'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
