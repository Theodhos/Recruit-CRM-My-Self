-- The Permanent pipeline's hired stage is now called Active Employees & Jobs (the job completes when someone gets there).
UPDATE pipeline_stages SET name = 'Active Employees & Jobs' WHERE type = 'PLACED' AND name = 'Active Employees' AND "pipelineId" IN (SELECT id FROM pipelines WHERE "employmentType" = 'PERMANENT');
