-- The recruiters who work a job together with its owner (ownerId stays the first one chosen).
ALTER TABLE "jobs" ADD COLUMN "coRecruiterIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
