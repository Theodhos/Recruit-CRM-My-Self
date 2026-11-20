-- Temporary pipelines get a "Screening" stage (right before "Active", or first when there is no Active) when they have no screening stage yet.
DO $$
DECLARE
  p RECORD;
  pos INTEGER;
BEGIN
  FOR p IN
    SELECT id FROM pipelines
    WHERE "employmentType" = 'TEMPORARY'
      AND NOT EXISTS (SELECT 1 FROM pipeline_stages s WHERE s."pipelineId" = pipelines.id AND s.name ILIKE '%screening%')
  LOOP
    SELECT COALESCE((SELECT MIN("order") FROM pipeline_stages WHERE "pipelineId" = p.id AND lower(trim(name)) = 'active'), 1) INTO pos;
    UPDATE pipeline_stages SET "order" = "order" + 1000 WHERE "pipelineId" = p.id AND "order" >= pos;
    INSERT INTO pipeline_stages (id, "pipelineId", name, "order", type, "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, p.id, 'Screening', pos, 'STANDARD', now(), now());
    UPDATE pipeline_stages SET "order" = "order" - 999 WHERE "pipelineId" = p.id AND "order" >= pos + 1000;
  END LOOP;
END $$;
