-- Run this in Supabase SQL Editor AFTER the main schema + callbacks schema
-- Adds device groups feature

-- Device groups table
create table if not exists public.device_groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  created_at timestamptz default now()
);

-- Add group_id to devices table
alter table public.devices add column if not exists group_id uuid references public.device_groups(id) on delete set null;

-- Add device_group_id to campaigns table
alter table public.campaigns add column if not exists device_group_id uuid references public.device_groups(id) on delete set null;

-- RLS for device_groups
alter table public.device_groups enable row level security;

create policy "Admins manage device_groups" on public.device_groups
  for all using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

-- Index for faster lookups
create index if not exists idx_devices_group on public.devices(group_id);
create index if not exists idx_campaigns_group on public.campaigns(device_group_id);
