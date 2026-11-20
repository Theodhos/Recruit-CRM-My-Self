-- A status chosen by hand in the Candidates table (AVAILABLE | ON_HOLD | NOT_AVAILABLE | DO_NOT_USE); empty = worked out from the pipeline.
ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "manualStatus" TEXT;
