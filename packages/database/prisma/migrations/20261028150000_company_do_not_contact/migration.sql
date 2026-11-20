-- Pipeline Companies: a company moved to Lost with the "Do not contact" button keeps that tag.
ALTER TABLE "companies" ADD COLUMN "doNotContact" BOOLEAN NOT NULL DEFAULT false;
