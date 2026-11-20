-- The Screening stage added by the previous migration got a UUID; the API only accepts cuid-shaped ids (c + letters/digits). Re-key it.
UPDATE pipeline_stages
SET id = 'c' || md5(random()::text || clock_timestamp()::text || id)
WHERE id LIKE '%-%' AND name = 'Screening';
