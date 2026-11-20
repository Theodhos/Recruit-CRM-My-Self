-- Temporary jobs: working hours, days off and one shift per person.
ALTER TABLE "jobs" ADD COLUMN "workingHours" TEXT;
ALTER TABLE "jobs" ADD COLUMN "daysOff" TEXT;
ALTER TABLE "jobs" ADD COLUMN "shifts" TEXT[] DEFAULT ARRAY[]::TEXT[];
