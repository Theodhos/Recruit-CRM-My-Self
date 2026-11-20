-- Additive only. New optional candidate fields for filtering (trade, grade, experience, skills, qualifications,
-- employment status, last contacted), contact consent per channel, and the permission to export candidates.
-- Nothing is dropped, retyped or overwritten; every existing candidate gets "no consent recorded".
CREATE TYPE "CandidateGrade" AS ENUM ('A', 'B', 'C');
CREATE TYPE "CandidateEmploymentStatus" AS ENUM ('EMPLOYED', 'SELF_EMPLOYED', 'UNEMPLOYED');
CREATE TYPE "ConsentStatus" AS ENUM ('UNKNOWN', 'GRANTED', 'OPTED_OUT');

ALTER TABLE "candidates" ADD COLUMN "trade" TEXT;
ALTER TABLE "candidates" ADD COLUMN "grade" "CandidateGrade";
ALTER TABLE "candidates" ADD COLUMN "employmentStatus" "CandidateEmploymentStatus";
ALTER TABLE "candidates" ADD COLUMN "experienceYears" INTEGER;
ALTER TABLE "candidates" ADD COLUMN "experienceNotes" TEXT;
ALTER TABLE "candidates" ADD COLUMN "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "candidates" ADD COLUMN "qualifications" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "candidates" ADD COLUMN "lastContactedAt" TIMESTAMP(3);
ALTER TABLE "candidates" ADD COLUMN "smsConsent" "ConsentStatus" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "candidates" ADD COLUMN "emailConsent" "ConsentStatus" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "candidates" ADD COLUMN "callConsent" "ConsentStatus" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "candidates" ADD COLUMN "consentUpdatedAt" TIMESTAMP(3);

CREATE INDEX "candidates_organisationId_grade_idx" ON "candidates"("organisationId", "grade");
CREATE INDEX "candidates_organisationId_lastContactedAt_idx" ON "candidates"("organisationId", "lastContactedAt");
CREATE INDEX "candidates_organisationId_postalCode_idx" ON "candidates"("organisationId", "postalCode");
CREATE INDEX "candidates_skills_idx" ON "candidates" USING GIN ("skills");
CREATE INDEX "candidates_qualifications_idx" ON "candidates" USING GIN ("qualifications");

-- The export permission is new; everyone who may already edit candidates keeps working with it.
INSERT INTO "permissions" ("id", "key", "module", "description", "createdAt")
VALUES ('perm_candidate_export', 'candidate:export', 'candidate', 'Export candidate contact lists', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT 'rp_export_' || rp."roleId", rp."roleId", p."id", CURRENT_TIMESTAMP
FROM "role_permissions" rp
JOIN "permissions" src ON src."id" = rp."permissionId" AND src."key" = 'candidate:update'
JOIN "permissions" p ON p."key" = 'candidate:export'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
