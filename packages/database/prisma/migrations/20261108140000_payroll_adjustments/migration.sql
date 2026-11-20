-- Additive only: manual payroll control — bonus / deduction / fee lines and calculation overrides on a timesheet, extra lines on the payslip, and five more history events.
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TimesheetEventAction" ADD VALUE 'ADJUSTMENT_ADDED';
ALTER TYPE "TimesheetEventAction" ADD VALUE 'ADJUSTMENT_REMOVED';
ALTER TYPE "TimesheetEventAction" ADD VALUE 'OVERRIDDEN';
ALTER TYPE "TimesheetEventAction" ADD VALUE 'OVERRIDE_CLEARED';
ALTER TYPE "TimesheetEventAction" ADD VALUE 'RECALCULATED';

-- AlterTable
ALTER TABLE "payslips" ADD COLUMN     "extraLines" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "timesheets" ADD COLUMN     "adjustments" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "overrides" JSONB;

