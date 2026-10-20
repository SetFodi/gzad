-- Metered billing (October 2026)
--
-- Moves billing from whole slot-hours to 10-minute blocks prorated by the plays
-- that actually happened, bills only airtime a campaign aired while active,
-- adds per-campaign daily caps, low-balance alert storage, read views and
-- retention helpers. Plan: docs/billing-metering-plan.md.
--
-- Requires 009 (balance_transactions, adjust_client_balance). Everything here
-- is additive: the current billing route keeps working after this runs, and
-- the new route only bills in 10-minute blocks once BILLING_METERED_FROM is set.
-- Needs Postgres 15+ (security_invoker views, nulls not distinct).
--
-- Safe to re-run.

-- ═══ 1. Campaign status history ═════════════════════════════════════════════
-- Billing asks "was this campaign active when the ad played?", not "is it
-- active now", so pausing never makes not-yet-billed airtime free and
-- re-activating never bills plays from the paused period.

create table if not exists public.campaign_status_history (
  id          bigserial   primary key,
  campaign_id uuid        not null references public.campaigns(id) on delete cascade,
  status      text        not null,
  changed_at  timestamptz not null default now()
);

create index if not exists idx_campaign_status_history
  on public.campaign_status_history(campaign_id, changed_at desc);

alter table public.campaign_status_history enable row level security;

drop policy if exists "Admins read campaign_status_history" on public.campaign_status_history;
create policy "Admins read campaign_status_history" on public.campaign_status_history
  for select using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

-- security definer: clients insert campaigns through PostgREST and have no
-- policy on the history table.
create or replace function public.log_campaign_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.campaign_status_history (campaign_id, status) values (new.id, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_campaign_status_history on public.campaigns;
create trigger trg_campaign_status_history
  after insert or update of status on public.campaigns
  for each row execute function public.log_campaign_status();

-- Existing campaigns start their history at creation with today's status.
-- Nothing before this migration is billed by the new route anyway (§8 of the plan).
insert into public.campaign_status_history (campaign_id, status, changed_at)
select c.id, c.status, coalesce(c.created_at, now())
from public.campaigns c
where not exists (select 1 from public.campaign_status_history h where h.campaign_id = c.id);

-- Was the campaign billable at this instant: active per its history, and the
-- Tbilisi date inside its start/end window (same rule as lib/campaigns.ts).
create or replace function public.campaign_billable_at(p_campaign_id uuid, p_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
           select h.status = 'active'
           from public.campaign_status_history h
           where h.campaign_id = p_campaign_id and h.changed_at <= p_at
           order by h.changed_at desc
           limit 1
         ), false)
     and exists (
           select 1 from public.campaigns c
           where c.id = p_campaign_id
             and (c.start_date is null or (p_at at time zone 'Asia/Tbilisi')::date >= c.start_date)
             and (c.end_date   is null or (p_at at time zone 'Asia/Tbilisi')::date <= c.end_date)
         )
$$;

revoke all on function public.campaign_billable_at(uuid, timestamptz) from public, anon, authenticated;

-- ═══ 2. Daily spend cap ══════════════════════════════════════════════════════

alter table public.campaigns add column if not exists daily_cap numeric(10,2);

alter table public.campaigns drop constraint if exists campaigns_daily_cap_check;
alter table public.campaigns add constraint campaigns_daily_cap_check
  check (daily_cap is null or daily_cap > 0);

-- paused_cap: daily cap reached; the billing run resumes it at Tbilisi midnight.
alter table public.campaigns drop constraint if exists campaigns_status_check;
alter table public.campaigns add constraint campaigns_status_check
  check (status in ('draft', 'pending_review', 'active', 'paused', 'paused_billing', 'paused_cap', 'completed'));

-- ═══ 3. billing_logs: 10-minute blocks ══════════════════════════════════════
-- Views read total_cost; drop them so the type change can re-run.

drop view if exists public.billing_hourly;
drop view if exists public.billing_daily_totals;

alter table public.billing_logs
  add column if not exists billing_unit   text not null default 'slot_hour',
  add column if not exists plays          int,
  add column if not exists expected_plays int,
  add column if not exists loop_seconds   int,
  add column if not exists proration      numeric(6,4),
  add column if not exists gross_cost     numeric(12,6),
  add column if not exists updated_at     timestamptz;

-- Rows keep exact costs; the balance moves in whole tetri with a carry (§2.8).
alter table public.billing_logs alter column total_cost type numeric(12,6);

alter table public.billing_logs drop constraint if exists billing_logs_unit_check;
alter table public.billing_logs add constraint billing_logs_unit_check
  check (billing_unit in ('slot_hour', 'block_10m'));

create index if not exists idx_billing_logs_client_period
  on public.billing_logs(client_id, period_start desc);
drop index if exists public.idx_billing_logs_client;   -- covered by the composite

create index if not exists idx_billing_logs_campaign_period
  on public.billing_logs(campaign_id, period_start);

-- ═══ 4. Late-log detection ══════════════════════════════════════════════════
-- received_at follows insertion order, so a BRIN index is a few pages.

create index if not exists idx_play_logs_received_brin
  on public.play_logs using brin (received_at);
create index if not exists idx_play_logs_device_began
  on public.play_logs(device_id, began_at);
create index if not exists idx_gps_logs_device_recorded
  on public.gps_logs(device_serial, recorded_at);

-- ═══ 5. Run state, rounding carry, alerts, settings ═════════════════════════

create table if not exists public.billing_state (
  key        text primary key,
  value      jsonb not null default '{}',
  updated_at timestamptz default now()
);
alter table public.billing_state enable row level security;   -- no policies: service role only

-- Late logs are found by received_at after this point; nothing older is
-- billed retroactively.
insert into public.billing_state (key, value)
values ('late_log_watermark', jsonb_build_object('at', now()))
on conflict (key) do nothing;

create table if not exists public.billing_carry (
  client_id  uuid primary key references public.clients(id) on delete cascade,
  carry      numeric(12,6) not null default 0,
  updated_at timestamptz default now()
);
alter table public.billing_carry enable row level security;   -- no policies: service role only

create table if not exists public.billing_alerts (
  id           uuid        default gen_random_uuid() primary key,
  client_id    uuid        not null references public.clients(id) on delete cascade,
  campaign_id  uuid        references public.campaigns(id) on delete set null,
  kind         text        not null check (kind in ('low_20pct', 'runway_1d', 'depleted', 'cap_reached')),
  balance      numeric(10,2),
  detail       jsonb,
  dedupe_key   text        not null unique,
  created_at   timestamptz default now(),
  sent_at      timestamptz,
  dismissed_at timestamptz
);
create index if not exists idx_billing_alerts_client on public.billing_alerts(client_id, created_at desc);
alter table public.billing_alerts enable row level security;

drop policy if exists "Admins manage billing_alerts" on public.billing_alerts;
create policy "Admins manage billing_alerts" on public.billing_alerts
  for all using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

drop policy if exists "Clients view own billing_alerts" on public.billing_alerts;
create policy "Clients view own billing_alerts" on public.billing_alerts
  for select using (
    client_id in (select id from public.clients where auth_user_id = auth.uid())
  );

insert into public.pricing_config (key, value) values ('billing_settings', '{
  "settle_minutes": 10,
  "recent_hours": 3,
  "late_log_max_days": 7,
  "low_balance_pct": 20,
  "runway_days": 1,
  "play_logs_keep_days": 30,
  "gps_logs_keep_days": 14,
  "billing_detail_keep_days": 90
}') on conflict (key) do nothing;

-- ═══ 6. Usage reads (service role only) ═════════════════════════════════════
-- Both take the same candidate set: blocks starting in [p_from, p_to), plus any
-- block before p_to touched by a play received since p_received_since (late
-- uploads), never older than p_late_from. p_to must sit on a block boundary.

-- One row per (device, block, program, campaign): how many plays, how many were
-- billable, and the program's typical play length (for the loop size).
create or replace function public.billing_block_usage(
  p_from           timestamptz,
  p_to             timestamptz,
  p_received_since timestamptz,
  p_late_from      timestamptz,
  p_block_minutes  int default 10
)
returns table (
  device_id       text,
  block_start     timestamptz,
  program_name    text,
  campaign_id     uuid,
  plays           int,
  billable_plays  int,
  typical_seconds numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with step as (
    select make_interval(mins => p_block_minutes) as len
  ),
  candidates as (
    select distinct pl.device_id,
           date_bin((select len from step), pl.began_at, timestamptz '2000-01-01 00:00:00+00') as block_start
    from public.play_logs pl
    where pl.began_at < p_to
      and (
        pl.began_at >= p_from
        or (p_received_since is not null
            and pl.received_at >= p_received_since
            and pl.began_at >= p_late_from)
      )
  ),
  block_plays as (
    select c.block_start, pl.device_id, pl.program_name, pl.campaign_id, pl.began_at, pl.duration_seconds
    from candidates c
    join public.play_logs pl
      on pl.device_id = c.device_id
     and pl.began_at >= c.block_start
     and pl.began_at <  c.block_start + (select len from step)
    -- A clock running ahead of the upload is not trusted (counted separately).
    where pl.began_at <= pl.received_at + interval '5 minutes'
  )
  select bp.device_id,
         bp.block_start,
         bp.program_name,
         bp.campaign_id,
         count(*)::int,
         (count(*) filter (
            where bp.campaign_id is not null
              and public.campaign_billable_at(bp.campaign_id, bp.began_at)
         ))::int,
         percentile_cont(0.5) within group (order by bp.duration_seconds)::numeric
  from block_plays bp
  group by bp.device_id, bp.block_start, bp.program_name, bp.campaign_id
  order by bp.device_id, bp.block_start, bp.program_name
$$;

revoke all on function public.billing_block_usage(timestamptz, timestamptz, timestamptz, timestamptz, int)
  from public, anon, authenticated;

-- Where each candidate device-block was: GPS points rounded to ~100 m with how
-- often each was seen (from plays and the GPS subscription), plus the first
-- fix of the block. Blocks with no fix get the nearest play fix within 10 min.
create or replace function public.billing_block_positions(
  p_from           timestamptz,
  p_to             timestamptz,
  p_received_since timestamptz,
  p_late_from      timestamptz,
  p_block_minutes  int default 10
)
returns table (
  device_id   text,
  block_start timestamptz,
  lat         numeric,
  lng         numeric,
  n           int,
  first_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with step as (
    select make_interval(mins => p_block_minutes) as len
  ),
  candidates as (
    select distinct pl.device_id,
           date_bin((select len from step), pl.began_at, timestamptz '2000-01-01 00:00:00+00') as block_start
    from public.play_logs pl
    where pl.began_at < p_to
      and (
        pl.began_at >= p_from
        or (p_received_since is not null
            and pl.received_at >= p_received_since
            and pl.began_at >= p_late_from)
      )
  ),
  fixes as (
    select c.device_id, c.block_start, pl.lat, pl.lng, pl.began_at as at
    from candidates c
    join public.play_logs pl
      on pl.device_id = c.device_id
     and pl.began_at >= c.block_start
     and pl.began_at <  c.block_start + (select len from step)
    where pl.lat <> 0 and pl.lng <> 0
    union all
    select c.device_id, c.block_start, g.lat, g.lng, g.recorded_at
    from candidates c
    join public.gps_logs g
      on g.device_serial = c.device_id
     and g.recorded_at >= c.block_start
     and g.recorded_at <  c.block_start + (select len from step)
    where g.lat <> 0 and g.lng <> 0
  ),
  nearest as (
    select c.device_id, c.block_start, f.lat, f.lng, f.began_at as at
    from candidates c
    cross join lateral (
      select pl.lat, pl.lng, pl.began_at
      from public.play_logs pl
      where pl.device_id = c.device_id
        and pl.lat <> 0 and pl.lng <> 0
        and pl.began_at >= c.block_start - interval '10 minutes'
        and pl.began_at <  c.block_start + (select len from step) + interval '10 minutes'
      order by abs(extract(epoch from pl.began_at - (c.block_start + (select len from step) / 2)))
      limit 1
    ) f
    where not exists (
      select 1 from fixes x where x.device_id = c.device_id and x.block_start = c.block_start
    )
  ),
  points as (
    select * from fixes
    union all
    select * from nearest
  )
  select p.device_id,
         p.block_start,
         round(p.lat, 3),
         round(p.lng, 3),
         count(*)::int,
         min(p.at)
  from points p
  group by p.device_id, p.block_start, round(p.lat, 3), round(p.lng, 3)
  order by p.device_id, p.block_start
$$;

revoke all on function public.billing_block_positions(timestamptz, timestamptz, timestamptz, timestamptz, int)
  from public, anon, authenticated;

-- ═══ 7. Posting: rows, daily cap, balance and ledger in one transaction ═════
-- p_rows: one object per (campaign, device, period) with the computed price.
-- Only rows actually inserted, or raised by late plays, move money. A repeat
-- run with nothing new charges 0.

create or replace function public.post_billing_blocks(p_client_id uuid, p_rows jsonb, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r         record;
  v_old     public.billing_logs%rowtype;
  v_cap     numeric;
  v_spent   numeric;
  v_total   numeric;
  v_delta   numeric := 0;
  v_rows    int := 0;
  v_carry   numeric;
  v_post    numeric;
  v_balance numeric;
  v_capped  uuid[] := '{}';
  v_day     timestamptz;
begin
  for r in
    select *
    from jsonb_to_recordset(p_rows) as x(
      campaign_id uuid, device_id text, period_start timestamptz, period_end timestamptz,
      billing_unit text, base_rate numeric, district text, district_tier int,
      district_multiplier numeric, time_multiplier numeric, plays int, expected_plays int,
      loop_seconds int, proration numeric, gross_cost numeric, ad_duration_seconds int
    )
    order by campaign_id, period_start, device_id   -- one lock order for overlapping runs
  loop
    -- Locking the campaign serialises its daily cap between overlapping runs.
    select daily_cap into v_cap
    from public.campaigns
    where id = r.campaign_id and client_id = p_client_id
    for update;
    if not found then
      continue;
    end if;

    -- Never bill the same airtime under both units (switch-over or rollback).
    if exists (
      select 1 from public.billing_logs b
      where b.campaign_id = r.campaign_id
        and b.device_id = r.device_id
        and b.billing_unit <> r.billing_unit
        and b.period_start < r.period_end
        and b.period_end > r.period_start
    ) then
      continue;
    end if;

    select * into v_old
    from public.billing_logs
    where campaign_id = r.campaign_id and device_id = r.device_id and period_start = r.period_start
    for update;

    if v_old.id is not null then
      -- Rows from before this pipeline (plays is null) are never re-priced, and
      -- a row only changes when late plays raised its play count.
      if v_old.plays is null or coalesce(r.plays, 0) <= v_old.plays then
        continue;
      end if;
    end if;

    v_total := r.gross_cost;

    if v_cap is not null then
      v_day := date_trunc('day', r.period_start at time zone 'Asia/Tbilisi') at time zone 'Asia/Tbilisi';
      select coalesce(sum(total_cost), 0) into v_spent
      from public.billing_logs
      where campaign_id = r.campaign_id
        and period_start >= v_day
        and period_start <  v_day + interval '1 day'
        and id is distinct from v_old.id;
      v_total := least(v_total, greatest(v_cap - v_spent, 0));
      if v_spent + v_total >= v_cap and not (r.campaign_id = any(v_capped)) then
        v_capped := array_append(v_capped, r.campaign_id);
      end if;
    end if;

    if v_old.id is null then
      insert into public.billing_logs (
        client_id, campaign_id, device_id, period_start, period_end,
        billing_unit, base_rate, district, district_tier, district_multiplier, time_multiplier,
        plays, expected_plays, loop_seconds, proration, gross_cost, total_cost, ad_duration_seconds
      ) values (
        p_client_id, r.campaign_id, r.device_id, r.period_start, r.period_end,
        r.billing_unit, r.base_rate, r.district, r.district_tier, r.district_multiplier, r.time_multiplier,
        r.plays, r.expected_plays, r.loop_seconds, r.proration, r.gross_cost, v_total, r.ad_duration_seconds
      )
      on conflict (campaign_id, device_id, period_start) do nothing;
      if found then
        v_delta := v_delta + v_total;
        v_rows := v_rows + 1;
      end if;
    else
      v_total := greatest(v_total, v_old.total_cost);   -- never lower a charged row
      update public.billing_logs set
        plays               = r.plays,
        expected_plays      = r.expected_plays,
        loop_seconds        = r.loop_seconds,
        proration           = r.proration,
        district            = r.district,
        district_tier       = r.district_tier,
        district_multiplier = r.district_multiplier,
        gross_cost          = r.gross_cost,
        total_cost          = v_total,
        updated_at          = now()
      where id = v_old.id;
      v_delta := v_delta + (v_total - v_old.total_cost);
      v_rows := v_rows + 1;
    end if;
  end loop;

  insert into public.billing_carry (client_id) values (p_client_id) on conflict (client_id) do nothing;
  select carry into v_carry from public.billing_carry where client_id = p_client_id for update;

  v_post := round(v_delta + v_carry, 2);
  update public.billing_carry
  set carry = v_delta + v_carry - v_post, updated_at = now()
  where client_id = p_client_id;

  if v_post <> 0 then
    v_balance := public.adjust_client_balance(p_client_id, -v_post);
    insert into public.balance_transactions (client_id, amount, balance_after, type, note)
    values (p_client_id, -v_post, v_balance, 'billing', p_note);
  else
    select balance into v_balance from public.clients where id = p_client_id;
  end if;

  if array_length(v_capped, 1) > 0 then
    update public.campaigns
    set status = 'paused_cap'
    where id = any(v_capped) and status = 'active';
  end if;

  return jsonb_build_object(
    'charged', v_post,
    'exact',   v_delta,
    'rows',    v_rows,
    'balance', v_balance,
    'capped',  to_jsonb(v_capped)
  );
end;
$$;

revoke all on function public.post_billing_blocks(uuid, jsonb, text) from public, anon, authenticated;

-- ═══ 8. Daily rollup and read views ═════════════════════════════════════════

create table if not exists public.billing_daily (
  id             bigserial     primary key,
  client_id      uuid          references public.clients(id)   on delete set null,
  campaign_id    uuid          references public.campaigns(id) on delete set null,
  device_id      text          not null,
  day            date          not null,
  blocks         int           not null default 0,
  plays          int,
  expected_plays int,
  gross_cost     numeric(14,6),
  total_cost     numeric(14,6) not null default 0
);

create unique index if not exists idx_billing_daily_key
  on public.billing_daily (campaign_id, device_id, day) nulls not distinct;
create index if not exists idx_billing_daily_client on public.billing_daily (client_id, day desc);

alter table public.billing_daily enable row level security;

drop policy if exists "Admins manage billing_daily" on public.billing_daily;
create policy "Admins manage billing_daily" on public.billing_daily
  for all using (
    exists (select 1 from public.clients where auth_user_id = auth.uid() and is_admin = true)
  );

drop policy if exists "Clients view own billing_daily" on public.billing_daily;
create policy "Clients view own billing_daily" on public.billing_daily
  for select using (
    client_id in (select id from public.clients where auth_user_id = auth.uid())
  );

-- security_invoker is required: a plain view runs as its owner and would show
-- every client's billing to every logged-in user.

-- One row per (client, campaign, device, hour): old hourly rows map 1:1 and six
-- 10-minute blocks fold into one, so the portal and admin keep their shape.
create or replace view public.billing_hourly with (security_invoker = true) as
select bl.client_id,
       bl.campaign_id,
       c.name                                   as campaign_name,
       bl.device_id,
       date_trunc('hour', bl.period_start)      as hour_start,
       max(bl.billing_unit)                     as billing_unit,
       count(*)::int                            as blocks,
       sum(bl.plays)::int                       as plays,
       sum(bl.expected_plays)::int              as expected_plays,
       mode() within group (order by bl.district) as district,
       max(bl.district_tier)                    as district_tier,
       max(bl.time_multiplier)                  as time_multiplier,
       max(bl.base_rate)                        as base_rate,
       sum(bl.total_cost)                       as total_cost,
       -- Share of a full slot-hour charged: 1.00 for old hourly rows.
       case
         when max(bl.billing_unit) = 'slot_hour' then 1.0
         else round(sum(bl.proration) / 6.0, 4)
       end                                      as coverage
from public.billing_logs bl
left join public.campaigns c on c.id = bl.campaign_id
group by bl.client_id, bl.campaign_id, c.name, bl.device_id, date_trunc('hour', bl.period_start);

-- Spend per (client, campaign, Tbilisi day), detail plus rolled-up history.
create or replace view public.billing_daily_totals with (security_invoker = true) as
select client_id, campaign_id, day, sum(total_cost) as total_cost, sum(blocks)::int as blocks
from (
  select bl.client_id,
         bl.campaign_id,
         (bl.period_start at time zone 'Asia/Tbilisi')::date as day,
         bl.total_cost,
         1 as blocks
  from public.billing_logs bl
  union all
  select bd.client_id, bd.campaign_id, bd.day, bd.total_cost, bd.blocks
  from public.billing_daily bd
) t
group by client_id, campaign_id, day;

-- ═══ 9. Retention ═══════════════════════════════════════════════════════════

-- Folds billing_logs detail older than p_before into billing_daily, then
-- deletes it, in one transaction.
create or replace function public.rollup_billing_logs(p_before date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := p_before::timestamp at time zone 'Asia/Tbilisi';
  v_rows   int;
begin
  insert into public.billing_daily as d
    (client_id, campaign_id, device_id, day, blocks, plays, expected_plays, gross_cost, total_cost)
  select client_id, campaign_id, device_id,
         (period_start at time zone 'Asia/Tbilisi')::date,
         count(*), sum(plays), sum(expected_plays), sum(gross_cost), sum(total_cost)
  from public.billing_logs
  where period_start < v_cutoff
  group by client_id, campaign_id, device_id, (period_start at time zone 'Asia/Tbilisi')::date
  on conflict (campaign_id, device_id, day) do update set
    blocks         = d.blocks + excluded.blocks,
    plays          = coalesce(d.plays, 0) + coalesce(excluded.plays, 0),
    expected_plays = coalesce(d.expected_plays, 0) + coalesce(excluded.expected_plays, 0),
    gross_cost     = coalesce(d.gross_cost, 0) + coalesce(excluded.gross_cost, 0),
    total_cost     = d.total_cost + excluded.total_cost;

  delete from public.billing_logs where period_start < v_cutoff;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Batched deletes; anything newer than 10 days is refused so the 7-day
-- late-billing window always has its raw plays.
create or replace function public.prune_play_logs(p_before timestamptz, p_batch int default 20000)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  if p_before > now() - interval '10 days' then
    raise exception 'refusing to prune play_logs newer than 10 days (late billing needs them)';
  end if;
  delete from public.play_logs
  where id in (select id from public.play_logs where began_at < p_before limit p_batch);
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

create or replace function public.prune_gps_logs(p_before timestamptz, p_batch int default 20000)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  if p_before > now() - interval '10 days' then
    raise exception 'refusing to prune gps_logs newer than 10 days';
  end if;
  delete from public.gps_logs
  where id in (select id from public.gps_logs where recorded_at < p_before limit p_batch);
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.rollup_billing_logs(date) from public, anon, authenticated;
revoke all on function public.prune_play_logs(timestamptz, int) from public, anon, authenticated;
revoke all on function public.prune_gps_logs(timestamptz, int) from public, anon, authenticated;
