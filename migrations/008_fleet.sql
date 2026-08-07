-- Fleet owners and their vehicles.
--
-- These objects were originally created ad hoc against the live database and
-- had no migration file, so a fresh environment could not be rebuilt from the
-- repository. This reconstructs them idempotently: running it against the
-- existing database only fills in what is missing (notably the RLS policies).

-- ─── clients.role ────────────────────────────────────────────────────────────
-- 'client' advertises, 'fleet' owns vehicles carrying the screens.
alter table public.clients
  add column if not exists role text not null default 'client';

alter table public.clients
  drop constraint if exists clients_role_check;
alter table public.clients
  add constraint clients_role_check check (role in ('client', 'fleet', 'admin'));

create index if not exists idx_clients_role on public.clients(role);

-- ─── fleet_vehicles ──────────────────────────────────────────────────────────
create table if not exists public.fleet_vehicles (
  id            uuid        default gen_random_uuid() primary key,
  fleet_user_id uuid        references public.clients(id) on delete cascade not null,
  make          text        not null,
  model         text        not null,
  year          int         not null,
  color         text        not null,
  license_plate text        not null,
  device_id     text        references public.devices(id) on delete set null,
  created_at    timestamptz default now()
);

-- One plate exists once, and a screen is in at most one car.
create unique index if not exists idx_fleet_vehicles_plate  on public.fleet_vehicles(license_plate);
create unique index if not exists idx_fleet_vehicles_device on public.fleet_vehicles(device_id)
  where device_id is not null;
create index if not exists idx_fleet_vehicles_owner on public.fleet_vehicles(fleet_user_id);

alter table public.fleet_vehicles enable row level security;

drop policy if exists "Fleet users manage own vehicles" on public.fleet_vehicles;
create policy "Fleet users manage own vehicles" on public.fleet_vehicles
  for all using (
    fleet_user_id in (
      select id from public.clients
      where auth_user_id = auth.uid() and role = 'fleet'
    )
  );

drop policy if exists "Admins manage all vehicles" on public.fleet_vehicles;
create policy "Admins manage all vehicles" on public.fleet_vehicles
  for all using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

-- ─── Device assignment is staff-only ─────────────────────────────────────────
-- Fleet owners manage their own vehicle rows, but must not be able to attach a
-- device_id themselves: /api/fleet/stats reports play logs and GPS for whatever
-- devices a vehicle claims, so self-assignment would expose another operator's
-- telemetry and inflate the claimer's numbers.

create or replace function public.guard_fleet_device_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_staff boolean;
begin
  v_is_staff := coalesce(auth.role(), '') = 'service_role'
    or exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true);

  if v_is_staff then
    return new;
  end if;

  if tg_op = 'INSERT' and new.device_id is not null then
    raise exception 'device assignment is managed by Gzad staff';
  end if;

  if tg_op = 'UPDATE' and new.device_id is distinct from old.device_id then
    raise exception 'device assignment is managed by Gzad staff';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_fleet_device_assignment on public.fleet_vehicles;
create trigger trg_guard_fleet_device_assignment
  before insert or update on public.fleet_vehicles
  for each row execute function public.guard_fleet_device_assignment();
