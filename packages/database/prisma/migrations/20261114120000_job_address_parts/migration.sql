-- The address of a job in parts (city, street, post code), all optional.
ALTER TABLE "jobs" ADD COLUMN "city" TEXT,
ADD COLUMN "street" TEXT,
ADD COLUMN "postcode" TEXT;
