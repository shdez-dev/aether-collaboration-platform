ALTER TABLE projects ALTER COLUMN methodology SET DEFAULT 'FLEXIBLE';
UPDATE projects SET methodology = 'FLEXIBLE' WHERE methodology = 'NONE';
