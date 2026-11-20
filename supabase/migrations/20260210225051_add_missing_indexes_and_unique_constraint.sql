
-- 1. CRITICAL: Unique index on play_stats to prevent duplicate aggregation rows
CREATE UNIQUE INDEX IF NOT EXISTS idx_play_stats_campaign_date 
  ON public.play_stats (campaign_id, date);

-- 2. Missing foreign key indexes (flagged by Supabase performance advisor)
CREATE INDEX IF NOT EXISTS idx_ad_media_campaign_id ON public.ad_media (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON public.campaigns (client_id);
CREATE INDEX IF NOT EXISTS idx_clients_auth_user_id ON public.clients (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_campaign_id ON public.invoices (campaign_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON public.invoices (client_id);
;
