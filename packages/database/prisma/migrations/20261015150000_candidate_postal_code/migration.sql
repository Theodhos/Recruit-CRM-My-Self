-- Post code of the candidate, kept apart from the free-text location so the Candidates table can show and search it.
ALTER TABLE "candidates" ADD COLUMN "postalCode" TEXT;
