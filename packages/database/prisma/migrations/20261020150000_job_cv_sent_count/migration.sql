-- CVs sent to the client for a job, entered by hand in the Jobs table.
ALTER TABLE "jobs" ADD COLUMN "cvSentCount" INTEGER NOT NULL DEFAULT 0;
