-- Where a company came from (chosen when it is added).
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "source" TEXT;
