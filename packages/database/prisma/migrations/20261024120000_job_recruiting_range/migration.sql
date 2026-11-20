-- Jobs: the date range in which candidates have to be found; when the end date arrives the job moves up the list and turns red.
ALTER TABLE "jobs" ADD COLUMN "recruitStartDate" TIMESTAMP(3);
ALTER TABLE "jobs" ADD COLUMN "recruitEndDate" TIMESTAMP(3);
