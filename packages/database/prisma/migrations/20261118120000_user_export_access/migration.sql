-- Candidates export is for administrators; the administrator can give it to a recruiter by hand.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "canExportCandidates" BOOLEAN NOT NULL DEFAULT false;
