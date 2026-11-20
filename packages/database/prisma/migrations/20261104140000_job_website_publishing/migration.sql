ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "JobStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

ALTER TABLE "jobs"
  ADD COLUMN "publishedOnWebsite" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "websitePublishedAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "showSalary" BOOLEAN NOT NULL DEFAULT true;

-- Jobs the careers site shows today stay visible.
UPDATE "jobs" SET "publishedOnWebsite" = true, "websitePublishedAt" = "createdAt"
WHERE "status" = 'OPEN' AND "deletedAt" IS NULL;
