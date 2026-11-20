
-- Step 1: Delete all duplicate play_logs, keeping only the earliest received_at per unique combo
DELETE FROM play_logs
WHERE id NOT IN (
  SELECT DISTINCT ON (device_id, program_name, began_at) id
  FROM play_logs
  ORDER BY device_id, program_name, began_at, received_at ASC
);

-- Step 2: Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS play_logs_dedup_idx 
ON play_logs (device_id, program_name, began_at);

-- Step 3: Truncate play_stats — will be recomputed correctly
TRUNCATE play_stats;
;
