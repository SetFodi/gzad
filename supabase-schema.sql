-- Gzad Client Dashboard Schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Clients table
create table public.clients (
  id uuid default gen_random_uuid() primary key,
  auth_user_id uuid references auth.users(id) on delete cascade,
  email text unique not null,
  company_name text not null,
  contact_name text not null,
  phone text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- Campaigns table
create table public.campaigns (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  name text not null,
  status text default 'draft' check (status in ('draft', 'pending_review', 'active', 'paused', 'completed')),
  start_date date,
  end_date date,
  daily_hours int default 1,
  taxi_count int default 1,
  monthly_price numeric(10,2),
  created_at timestamptz default now()
);

-- Ad media table
create table public.ad_media (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  file_url text not null,
  file_type text not null,
  file_name text not null,
  status text default 'pending_review' check (status in ('pending_review', 'approved', 'rejected')),
  uploaded_at timestamptz default now()
);

-- Play stats table (populated from vehhub exports)
create table public.play_stats (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  date date not null,
  play_count int default 0,
  total_duration_seconds int default 0,
  unique_taxis int default 0,
  km_covered numeric(10,2) default 0
);

-- Invoices table
create table public.invoices (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  amount numeric(10,2) not null,
  status text default 'pending' check (status in ('pending', 'paid', 'overdue')),
  due_date date not null,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- Row Level Security (RLS)
alter table public.clients enable row level security;
alter table public.campaigns enable row level security;
alter table public.ad_media enable row level security;
alter table public.play_stats enable row level security;
alter table public.invoices enable row level security;

-- Clients can only see their own data
create policy "Clients can view own profile" on public.clients
  for select using (auth_user_id = auth.uid());

create policy "Admins can view all clients" on public.clients
  for all using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

-- Campaigns: clients see own, admins see all
create policy "Clients can view own campaigns" on public.campaigns
  for select using (
    client_id in (select id from public.clients where auth_user_id = auth.uid())
  );

create policy "Clients can create campaigns" on public.campaigns
  for insert with check (
    client_id in (select id from public.clients where auth_user_id = auth.uid())
  );

create policy "Admins can manage all campaigns" on public.campaigns
  for all using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

-- Ad media: clients see own, admins see all
create policy "Clients can view own media" on public.ad_media
  for select using (
    campaign_id in (
      select c.id from public.campaigns c
      join public.clients cl on c.client_id = cl.id
      where cl.auth_user_id = auth.uid()
    )
  );

create policy "Clients can upload media" on public.ad_media
  for insert with check (
    campaign_id in (
      select c.id from public.campaigns c
      join public.clients cl on c.client_id = cl.id
      where cl.auth_user_id = auth.uid()
    )
  );

create policy "Admins can manage all media" on public.ad_media
  for all using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

-- Play stats: clients see own campaign stats
create policy "Clients can view own stats" on public.play_stats
  for select using (
    campaign_id in (
      select c.id from public.campaigns c
      join public.clients cl on c.client_id = cl.id
      where cl.auth_user_id = auth.uid()
    )
  );

create policy "Admins can manage all stats" on public.play_stats
  for all using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

-- Invoices: clients see own
create policy "Clients can view own invoices" on public.invoices
  for select using (
    client_id in (select id from public.clients where auth_user_id = auth.uid())
  );

create policy "Admins can manage all invoices" on public.invoices
  for all using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

-- Storage bucket for ad media
insert into storage.buckets (id, name, public) values ('ad-media', 'ad-media', true);

create policy "Anyone can view ad media" on storage.objects
  for select using (bucket_id = 'ad-media');

create policy "Authenticated users can upload" on storage.objects
  for insert with check (bucket_id = 'ad-media' and auth.role() = 'authenticated');

create policy "Admins can delete media" on storage.objects
  for delete using (
    bucket_id = 'ad-media' and
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );
