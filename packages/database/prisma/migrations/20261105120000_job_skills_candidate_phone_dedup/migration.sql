-- Additive only: three optional job text fields shown on the website, and a normalised phone on candidates so a
-- website applicant is recognised by e-mail OR phone. Nothing is dropped, retyped or overwritten.
ALTER TABLE "jobs" ADD COLUMN "skills" TEXT;
ALTER TABLE "jobs" ADD COLUMN "qualifications" TEXT;
ALTER TABLE "jobs" ADD COLUMN "applicationInstructions" TEXT;

ALTER TABLE "candidates" ADD COLUMN "normalizedPhone" TEXT;

-- Same rules as normalizeCandidatePhone() in apps/api (common/utils/phone.ts): "+" or "00" = the number already has a
-- country code, a single leading 0 = UK national number, anything shorter than 7 digits is not a usable number.
UPDATE "candidates"
SET "normalizedPhone" = n.value
FROM (
  SELECT "id",
    CASE
      WHEN length(regexp_replace("phone", '\D', '', 'g')) < 7 THEN NULL
      WHEN "phone" ~ '^\s*\+' THEN regexp_replace("phone", '\D', '', 'g')
      WHEN regexp_replace("phone", '\D', '', 'g') ~ '^00' THEN substr(regexp_replace("phone", '\D', '', 'g'), 3)
      WHEN regexp_replace("phone", '\D', '', 'g') ~ '^0' THEN '44' || substr(regexp_replace("phone", '\D', '', 'g'), 2)
      ELSE regexp_replace("phone", '\D', '', 'g')
    END AS value
  FROM "candidates" WHERE "phone" IS NOT NULL
) n
WHERE "candidates"."id" = n."id";

CREATE INDEX "candidates_organisationId_normalizedPhone_idx" ON "candidates"("organisationId", "normalizedPhone");
