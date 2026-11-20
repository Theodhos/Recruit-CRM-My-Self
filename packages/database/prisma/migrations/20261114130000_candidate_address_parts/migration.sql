-- A candidate address in parts (city, street); the post code already exists as "postalCode".
ALTER TABLE "candidates" ADD COLUMN "city" TEXT,
ADD COLUMN "street" TEXT;
