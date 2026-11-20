-- Where a job place is on the map (looked up in the background) for the "within x km" filter of the Jobs page.
ALTER TABLE "jobs" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "geocodedAt" TIMESTAMP(3);
