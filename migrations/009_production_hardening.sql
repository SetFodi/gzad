-- Production hardening (August 2026)
--
-- Closes the privilege gaps that let a client approve their own ads, makes
-- balance a ledgered value that only the server can move, gives every device
-- its own callback credential, and adds rate limiting storage.
--
-- Safe to re-run.

-- ═══ 1. Clients cannot approve their own advertising ═════════════════════════
-- The submit form writes status 'pending_review', but nothing stopped a client
-- from calling PostgREST directly with 'approved' / 'active' and putting
-- unreviewed content on the screens. Admin policies are separate and still
-- allow staff to insert at any status.

drop policy if exists "Clients can create campaigns" on public.campaigns;
create policy "Clients can create campaigns" on public.campaigns
  for insert with check (
    client_id in (select id from public.clients where auth_user_id = auth.uid())
    and status in ('draft', 'pending_review')
    -- Airtime is allocated by staff; a client cannot place itself on a device.
    and device_group_id is null
  );

drop policy if exists "Clients can upload media" on public.ad_media;
create policy "Clients can upload media" on public.ad_media
  for insert with check (
    campaign_id in (
      select c.id from public.campaigns c
      join public.clients cl on c.client_id = cl.id
      where cl.auth_user_id = auth.uid()
    )
    and status = 'pending_review'
  );

-- ═══ 2. Balance moves only through the server ════════════════════════════════
-- Top-ups used to be a read-modify-write from the admin's browser: no author,
-- no history, and two concurrent writes lost one of them.

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

create table if not exists public.balance_transactions (
  id            uuid          default gen_random_uuid() primary key,
  client_id     uuid          references public.clients(id) on delete cascade not null,
  amount        numeric(10,2) not null,
  balance_after numeric(10,2),
  type          text          not null check (type in ('topup', 'adjustment', 'billing', 'refund')),
  note          text,
  created_by    uuid          references public.clients(id) on delete set null,
  created_at    timestamptz   default now()
);

create index if not exists idx_balance_tx_client on public.balance_transactions(client_id, created_at desc);

alter table public.balance_transactions enable row level security;

drop policy if exists "Admins manage balance_transactions" on public.balance_transactions;
create policy "Admins manage balance_transactions" on public.balance_transactions
  for all using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

drop policy if exists "Clients view own balance_transactions" on public.balance_transactions;
create policy "Clients view own balance_transactions" on public.balance_transactions
  for select using (
    client_id in (select id from public.clients where auth_user_id = auth.uid())
  );

-- Even an admin session in the browser must not write balance directly, so that
-- the ledger is guaranteed to be complete.
create or replace function public.guard_client_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.balance is distinct from old.balance and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'balance can only be changed through the billing API';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_client_balance on public.clients;
create trigger trg_guard_client_balance
  before update on public.clients
  for each row execute function public.guard_client_balance();

-- ═══ 3. Per-device callback credentials ══════════════════════════════════════
-- One shared CALLBACK_SECRET was written into every controller's firmware, so
-- opening up a single taxi's device yielded the ability to forge play logs for
-- the entire fleet — and therefore any client's bill.

alter table public.devices
  add column if not exists api_key text;

update public.devices
  set api_key = encode(gen_random_bytes(24), 'hex')
  where api_key is null;

alter table public.devices
  alter column api_key set default encode(gen_random_bytes(24), 'hex');

create unique index if not exists idx_devices_api_key on public.devices(api_key);

-- ═══ 4. Rate limiting for unauthenticated endpoints ══════════════════════════

create table if not exists public.rate_limits (
  id         bigserial   primary key,
  key        text        not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_limits_key on public.rate_limits(key, created_at desc);

alter table public.rate_limits enable row level security;
-- No policies: only the service role touches this table.

create or replace function public.check_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- Occasional opportunistic cleanup; cheaper than sweeping on every call.
  if random() < 0.01 then
    delete from public.rate_limits where created_at < now() - interval '1 day';
  end if;

  select count(*) into v_count
  from public.rate_limits
  where key = p_key
    and created_at >= now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    return false;
  end if;

  insert into public.rate_limits(key) values (p_key);
  return true;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;

-- ═══ 5. Storage: uploads land in the uploader's own folder ═══════════════════
-- The old policy let any authenticated user write any path in a public bucket.

drop policy if exists "Authenticated users can upload" on storage.objects;
drop policy if exists "Clients upload to own folder" on storage.objects;
create policy "Clients upload to own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'ad-media'
    and (
      (storage.foldername(name))[1] in (
        select id::text from public.clients where auth_user_id = auth.uid()
      )
      -- Staff upload on a client's behalf under admin/.
      or exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
    )
  );

update storage.buckets
set file_size_limit = 104857600, -- 100 MB, matching the submit form
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp',
      'video/mp4', 'video/webm'
    ]
where id = 'ad-media';

-- ═══ 6. Constraints the application relies on ════════════════════════════════
-- (from 007_audit_fixes.sql — repeated here so a fresh database is correct
--  after running the migrations in order)

create unique index if not exists idx_campaigns_name_unique on public.campaigns (lower(name));
create unique index if not exists idx_play_stats_campaign_date on public.play_stats (campaign_id, date);

-- Stats outlive the campaign they describe.
alter table public.play_stats drop constraint if exists play_stats_campaign_id_fkey;
alter table public.play_stats add constraint play_stats_campaign_id_fkey
  foreign key (campaign_id) references public.campaigns(id) on delete set null;

-- Billing scans play_logs by period; campaign lookups happen on every callback.
create index if not exists idx_play_logs_period on public.play_logs(began_at, campaign_id);
create index if not exists idx_campaigns_status_group on public.campaigns(status, device_group_id);
