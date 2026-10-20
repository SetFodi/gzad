-- Requires migrations/001 through 010. This is prepared locally; apply it
-- before enabling AUTH_DEVICE_VERIFICATION in the application. Existing native
-- sessions have no approval and must complete the new-device email challenge.

create schema if not exists gzad_auth;
revoke all on schema gzad_auth from public, anon, authenticated;

create table if not exists public.auth_trusted_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_hash text not null check (device_hash ~ '^[a-f0-9]{64}$'),
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  agent_hash text not null check (agent_hash ~ '^[a-f0-9]{64}$'),
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (user_id, device_hash, ip_hash, agent_hash),
  check (expires_at > verified_at)
);

create table if not exists public.auth_verified_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_hash text not null check (device_hash ~ '^[a-f0-9]{64}$'),
  ip_hash text not null check (ip_hash ~ '^[a-f0-9]{64}$'),
  agent_hash text not null check (agent_hash ~ '^[a-f0-9]{64}$'),
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > verified_at)
);

create index if not exists idx_auth_verified_sessions_user on public.auth_verified_sessions(user_id);
create index if not exists idx_auth_verified_sessions_expiry on public.auth_verified_sessions(expires_at);
create index if not exists idx_auth_trusted_devices_expiry on public.auth_trusted_devices(expires_at);

alter table public.auth_trusted_devices enable row level security;
alter table public.auth_verified_sessions enable row level security;
-- No browser policies: only server code with the service role may approve a
-- native session or remember a verified browser. No raw browser token/IP/UA is
-- stored. These grants apply only to the new tables.
revoke all on public.auth_trusted_devices, public.auth_verified_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.auth_trusted_devices, public.auth_verified_sessions to service_role;

-- RLS cannot rely on the app's HttpOnly device cookie: browser Supabase calls
-- bypass Next entirely. Restrict the exact native JWT session_id, so obtaining
-- a public password/OTP grant alone never grants access to business data.
-- The definer is needed only to read the two service-only auth tables. Keep it
-- outside exposed schemas, with a fixed search path and explicit auth.uid().
create or replace function gzad_auth.session_is_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.auth_verified_sessions s
    where s.user_id = (select auth.uid())
      and s.session_id::text = (
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id'
      )
      and s.expires_at > statement_timestamp()
  );
$$;

revoke all on function gzad_auth.session_is_verified() from public, anon, authenticated;
grant usage on schema gzad_auth to authenticated;
grant execute on function gzad_auth.session_is_verified() to authenticated;

-- The original clients admin policy queried clients from its own RLS
-- predicate, which recurses even for an owner's SELECT. Preserve its exact
-- admin rule through a private, caller-scoped lookup that bypasses only this
-- recursive lookup. No user-controlled metadata participates in authorization.
create or replace function gzad_auth.user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.clients c
    where c.auth_user_id = (select auth.uid()) and c.is_admin = true
  );
$$;
revoke all on function gzad_auth.user_is_admin() from public, anon, authenticated;
grant execute on function gzad_auth.user_is_admin() to authenticated;

drop policy if exists "Admins can view all clients" on public.clients;
create policy "Admins can view all clients" on public.clients
  for all to authenticated
  using ((select gzad_auth.user_is_admin()))
  with check ((select gzad_auth.user_is_admin()));

-- Restrictive policies combine with every existing ownership/admin policy
-- using AND. No existing data grants or ownership permissions are widened.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'clients', 'campaigns', 'ad_media', 'play_stats', 'invoices',
    'play_logs', 'gps_logs', 'devices', 'device_groups', 'pricing_config',
    'billing_logs', 'fleet_vehicles', 'balance_transactions',
    'campaign_status_history', 'billing_alerts', 'billing_daily',
    'billing_state', 'billing_carry', 'rate_limits'
  ] loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'Required auth-protected table public.% is missing', v_table;
    end if;
    execute format('drop policy if exists "Verified session required" on public.%I', v_table);
    execute format(
      'create policy "Verified session required" on public.%I as restrictive to authenticated '
      || 'using ((select gzad_auth.session_is_verified())) '
      || 'with check ((select gzad_auth.session_is_verified()))', v_table
    );
  end loop;
end;
$$;

-- Public advertising media must remain readable by taxi screens and landing
-- pages. Gate only authenticated writes to the existing ad-media bucket.
drop policy if exists "Verified ad media insert" on storage.objects;
create policy "Verified ad media insert" on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'ad-media' or (select gzad_auth.session_is_verified()));

drop policy if exists "Verified ad media update" on storage.objects;
create policy "Verified ad media update" on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'ad-media' or (select gzad_auth.session_is_verified()))
  with check (bucket_id <> 'ad-media' or (select gzad_auth.session_is_verified()));

drop policy if exists "Verified ad media delete" on storage.objects;
create policy "Verified ad media delete" on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'ad-media' or (select gzad_auth.session_is_verified()));
