-- Billing system migration
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)

-- ─── Column additions to existing tables ────────────────────────────────────

-- Client balance (GEL, prepaid credit)
alter table public.clients
  add column if not exists balance numeric(10,2) default 0;

-- Ad slot duration in seconds (used for billing rate lookup)
alter table public.campaigns
  add column if not exists slot_duration int default 10;

-- Allow paused_billing as a campaign status
alter table public.campaigns
  drop constraint if exists campaigns_status_check;
alter table public.campaigns
  add constraint campaigns_status_check
  check (status in ('draft', 'pending_review', 'active', 'paused', 'paused_billing', 'completed'));

-- ─── pricing_config ──────────────────────────────────────────────────────────
-- Stores admin-controlled pricing parameters as key→jsonb rows.
-- Keys: base_rates, district_tiers, district_multipliers, time_multipliers

create table if not exists public.pricing_config (
  id          uuid        default gen_random_uuid() primary key,
  key         text        unique not null,
  value       jsonb       not null default '{}',
  updated_at  timestamptz default now()
);

alter table public.pricing_config enable row level security;

-- Only admins can read or write pricing config
create policy "Admins manage pricing_config" on public.pricing_config
  for all using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

-- Seed default pricing if table is empty
insert into public.pricing_config (key, value)
values
  ('base_rates',           '{"10": 2.0, "20": 3.4, "30": 4.6}'),
  ('district_tiers',       '{}'),
  ('district_multipliers', '{"1": 1.45, "2": 1.25, "3": 1.10, "4": 1.00}'),
  ('time_multipliers',     '{}')
on conflict (key) do nothing;

-- ─── billing_logs ────────────────────────────────────────────────────────────
-- One row per (campaign × device × billing period).
-- Unique constraint prevents double-billing on repeated cron runs.

create table if not exists public.billing_logs (
  id                    uuid        default gen_random_uuid() primary key,
  client_id             uuid        references public.clients(id)   on delete set null,
  campaign_id           uuid        references public.campaigns(id) on delete set null,
  device_id             text        not null,
  period_start          timestamptz not null,
  period_end            timestamptz not null,
  base_rate             numeric(8,4) not null,
  district              text        default 'Unknown',
  district_tier         int         default 4,
  district_multiplier   numeric(8,4) default 1.0,
  time_multiplier       numeric(8,4) default 1.0,
  total_cost            numeric(10,2) not null,
  ad_duration_seconds   int         default 10,
  created_at            timestamptz  default now()
);

-- Unique constraint used by upsert with ignoreDuplicates to prevent double-billing
create unique index if not exists idx_billing_logs_dedup
  on public.billing_logs(campaign_id, device_id, period_start);

-- Indexes for the pricing page queries
create index if not exists idx_billing_logs_client    on public.billing_logs(client_id);
create index if not exists idx_billing_logs_period    on public.billing_logs(period_start desc);

alter table public.billing_logs enable row level security;

-- Admins can manage all billing logs
create policy "Admins manage billing_logs" on public.billing_logs
  for all using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

-- Clients can view their own billing history
create policy "Clients view own billing_logs" on public.billing_logs
  for select using (
    client_id in (
      select id from public.clients where auth_user_id = auth.uid()
    )
  );
