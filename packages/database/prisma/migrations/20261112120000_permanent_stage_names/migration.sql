-- The Permanent pipeline's first three stages carry the agency's own names. Already applied by hand on production (2026-11-07); safe to run again.
UPDATE "pipeline_stages" s SET "name" = 'Interview 2' FROM "pipelines" p WHERE s."pipelineId" = p."id" AND p."employmentType" = 'PERMANENT' AND s."name" = 'Interview';
UPDATE "pipeline_stages" s SET "name" = 'Interview 1' FROM "pipelines" p WHERE s."pipelineId" = p."id" AND p."employmentType" = 'PERMANENT' AND s."name" = 'Screening';
UPDATE "pipeline_stages" s SET "name" = 'Sent CV' FROM "pipelines" p WHERE s."pipelineId" = p."id" AND p."employmentType" = 'PERMANENT' AND s."name" = 'Job Applicants';
