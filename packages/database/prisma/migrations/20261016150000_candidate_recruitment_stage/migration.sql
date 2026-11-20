-- Recruiting stage of the candidate (NEW, CV_SENT, INTERVIEW_1, PLACEMENT) and the data written in each stage.
ALTER TABLE "candidates" ADD COLUMN "recruitmentStage" TEXT NOT NULL DEFAULT 'NEW';
ALTER TABLE "candidates" ADD COLUMN "stageData" JSONB;
CREATE INDEX "candidates_organisationId_recruitmentStage_idx" ON "candidates"("organisationId", "recruitmentStage");
