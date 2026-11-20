-- Temporary jobs: start/end date, timezone, recurring type and the per-day shift grid (one JSON document).
ALTER TABLE "jobs" ADD COLUMN "schedule" JSONB;
