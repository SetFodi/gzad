-- Run this in Supabase SQL Editor AFTER the main schema
-- Adds tables for live controller callback data

-- Raw play logs from controller callbacks
create table if not exists public.play_logs (
  id uuid default gen_random_uuid() primary key,
  device_id text not null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  program_name text not null,
  program_id text,
  play_type text default 'program',
  began_at timestamptz not null,
  duration_seconds int not null,
  lat numeric(10,7) default 0,
  lng numeric(10,7) default 0,
  received_at timestamptz default now()
);

-- GPS position tracking
create table if not exists public.gps_logs (
  id uuid default gen_random_uuid() primary key,
  device_serial text not null,
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  speed numeric(6,2) default 0,
  recorded_at timestamptz default now()
);

-- Devices (controllers) registry
create table if not exists public.devices (
  id text primary key,
  name text,
  api_key text unique default encode(gen_random_bytes(24), 'hex'),
  last_seen_at timestamptz,
  last_lat numeric(10,7),
  last_lng numeric(10,7),
  created_at timestamptz default now()
);

-- Indexes for fast lookups
create index if not exists idx_play_logs_device on public.play_logs(device_id);
create index if not exists idx_play_logs_campaign on public.play_logs(campaign_id);
create index if not exists idx_play_logs_began on public.play_logs(began_at);
create index if not exists idx_gps_logs_device on public.gps_logs(device_serial);
create index if not exists idx_gps_logs_recorded on public.gps_logs(recorded_at);

-- RLS
alter table public.play_logs enable row level security;
alter table public.gps_logs enable row level security;
alter table public.devices enable row level security;

-- Admins can see everything
create policy "Admins manage play_logs" on public.play_logs
  for all using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

create policy "Admins manage gps_logs" on public.gps_logs
  for all using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

create policy "Admins manage devices" on public.devices
  for all using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

-- Clients can view play_logs for their campaigns
create policy "Clients view own play_logs" on public.play_logs
  for select using (
    campaign_id in (
      select c.id from public.campaigns c
      join public.clients cl on c.client_id = cl.id
      where cl.auth_user_id = auth.uid()
    )
  );

-- Insert a device record for the Y12 controller
insert into public.devices (id, name) values ('y1c-825-61009', 'Taxi #1 - Y12 Controller')
on conflict (id) do nothing;

-- MIGRATION: If you already ran the old SQL with gps_tracks, run this to migrate:
-- alter table public.gps_tracks rename to gps_logs;
-- alter table public.gps_logs rename column device_id to device_serial;
-- alter table public.gps_logs add column if not exists speed numeric(6,2) default 0;
