
-- Add unique constraint on (campaign_id, date) for proper upsert behavior
ALTER TABLE play_stats ADD CONSTRAINT play_stats_campaign_date_unique UNIQUE (campaign_id, date);
;
