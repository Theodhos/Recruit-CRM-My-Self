-- Every currency is GBP: new rows default to GBP and rows still marked USD are relabelled (amounts are not converted).
ALTER TABLE "jobs" ALTER COLUMN "currency" SET DEFAULT 'GBP';
ALTER TABLE "application_stage_notes" ALTER COLUMN "currency" SET DEFAULT 'GBP';
ALTER TABLE "fees" ALTER COLUMN "currency" SET DEFAULT 'GBP';
ALTER TABLE "retainers" ALTER COLUMN "currency" SET DEFAULT 'GBP';

UPDATE "jobs" SET "currency" = 'GBP' WHERE "currency" = 'USD';
UPDATE "application_stage_notes" SET "currency" = 'GBP' WHERE "currency" = 'USD';
UPDATE "fees" SET "currency" = 'GBP' WHERE "currency" = 'USD';
UPDATE "retainers" SET "currency" = 'GBP' WHERE "currency" = 'USD';
UPDATE "organisations" SET "settings" = jsonb_set("settings", '{payDefaults,currency}', '"GBP"') WHERE "settings" #>> '{payDefaults,currency}' = 'USD';
UPDATE "companies" SET "pipelineRecord" = jsonb_set("pipelineRecord", '{pay,currency}', '"GBP"') WHERE "pipelineRecord" #>> '{pay,currency}' = 'USD';
UPDATE "companies" SET "pipelineRecord" = jsonb_set("pipelineRecord", '{win,currency}', '"GBP"') WHERE "pipelineRecord" #>> '{win,currency}' = 'USD';
