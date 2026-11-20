-- Where a candidate address is on the map (looked up in the background) for the "within x km" filters.
ALTER TABLE "candidates" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "geocodedAt" TIMESTAMP(3);
