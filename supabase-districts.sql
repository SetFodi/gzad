-- Add district targeting to campaigns
-- Run in Supabase SQL editor

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS districts text[] DEFAULT NULL;

COMMENT ON COLUMN campaigns.districts IS
  'Tbilisi district names where this campaign should play. NULL = play everywhere.';
