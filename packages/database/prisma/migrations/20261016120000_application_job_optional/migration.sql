-- A candidate added by hand without a job still goes onto the pipeline (stage "New"); the job is linked later.
ALTER TABLE "applications" ALTER COLUMN "jobId" DROP NOT NULL;
