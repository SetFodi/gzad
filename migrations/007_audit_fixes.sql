-- Audit fixes migration (June 2026)
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)

-- ─── 1. Campaign names must be globally unique ───────────────────────────────
-- Play logs are matched back to campaigns BY NAME (case-insensitive), so two
-- clients with the same campaign name would cause plays and billing to be
-- attributed to the wrong client. The app checks via /api/campaigns/check-name,
-- but this index is the real guarantee.
-- NOTE: if this fails with a duplicate error, rename the duplicates first:
--   select lower(name), count(*) from public.campaigns group by 1 having count(*) > 1;
create unique index if not exists idx_campaigns_name_unique
  on public.campaigns (lower(name));

-- ─── 2. play_stats upsert target ─────────────────────────────────────────────
-- The playlog callback upserts with onConflict 'campaign_id,date'.
-- Without this unique index the upsert errors and stats silently stop updating.
create unique index if not exists idx_play_stats_campaign_date
  on public.play_stats (campaign_id, date);

-- ─── 3. Optional: atomic balance adjustments ─────────────────────────────────
-- The billing cron and admin top-ups both read-modify-write clients.balance.
-- This function makes the adjustment atomic; app code can adopt it later via
--   select public.adjust_client_balance('<client-id>', -3.40);
create or replace function public.adjust_client_balance(p_client_id uuid, p_amount numeric)
returns numeric
language sql
security definer
set search_path = public
as $$
  update public.clients
  set balance = round(coalesce(balance, 0) + p_amount, 2)
  where id = p_client_id
  returning balance;
$$;

revoke all on function public.adjust_client_balance(uuid, numeric) from public, anon, authenticated;
