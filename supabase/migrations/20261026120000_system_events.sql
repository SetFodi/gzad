-- One timeline of what the system did, for staff: billing runs, screens
-- connecting and dropping, playlist pushes and failures. Campaign status
-- changes, balance movements and billing alerts already have their own tables;
-- the admin Activity page reads those alongside this one.
--
-- Written only by the service role (billing route, realtime server callbacks).
-- Requires the auth trusted-sessions migration (gzad_auth helpers). Safe to re-run.

create table if not exists public.system_events (
  id          bigserial   primary key,
  occurred_at timestamptz not null default now(),
  category    text        not null check (category in ('screen', 'billing', 'system')),
  kind        text        not null,
  severity    text        not null default 'info' check (severity in ('info', 'success', 'warning', 'error')),
  title       text        not null,
  device_id   text,
  client_id   uuid        references public.clients(id)   on delete set null,
  campaign_id uuid        references public.campaigns(id) on delete set null,
  detail      jsonb       not null default '{}'::jsonb
);

create index if not exists idx_system_events_occurred on public.system_events (occurred_at desc);
create index if not exists idx_system_events_category on public.system_events (category, occurred_at desc);
create index if not exists idx_system_events_device on public.system_events (device_id, occurred_at desc)
  where device_id is not null;

alter table public.system_events enable row level security;

drop policy if exists "Admins read system_events" on public.system_events;
create policy "Admins read system_events" on public.system_events
  for select to authenticated
  using ((select gzad_auth.user_is_admin()));

-- Same rule as every other protected table: only a verified session reads.
drop policy if exists "Verified session required" on public.system_events;
create policy "Verified session required" on public.system_events
  as restrictive to authenticated
  using ((select gzad_auth.session_is_verified()))
  with check ((select gzad_auth.session_is_verified()));

revoke insert, update, delete on public.system_events from anon, authenticated;
