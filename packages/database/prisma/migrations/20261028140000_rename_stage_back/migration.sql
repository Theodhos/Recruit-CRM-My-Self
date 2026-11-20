-- The Permanent pipeline's hired stage keeps its original name, Active Employees.
UPDATE pipeline_stages SET name = 'Active Employees' WHERE type = 'PLACED' AND name = 'Active Employees & Jobs';
