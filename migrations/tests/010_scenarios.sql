-- Scenario tests for 010_metered_billing.sql. Run by tests/run-local.sh against
-- a throwaway database; everything happens inside one transaction that is
-- rolled back. Any failed assert aborts with its message.

begin;

-- The balance guard (009) only lets the service role move money.
set local request.jwt.claims = '{"role":"service_role"}';

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1');
insert into public.clients (id, auth_user_id, email, company_name, contact_name, balance) values
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'a@test', 'A', 'A', 100),
  ('c0000000-0000-0000-0000-000000000002', null, 'b@test', 'B', 'B', 50);
insert into public.devices (id, name) values ('dev-1', 'Taxi 1'), ('dev-2', 'Taxi 2');
insert into public.campaigns (id, client_id, name, status, slot_duration, start_date) values
  ('ca000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Camp One', 'active', 10, '2026-01-01'),
  ('ca000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Camp Two', 'active', 20, '2026-01-01'),
  ('ca000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 'Camp Three', 'active', 10, '2026-11-01');

-- ── 1. Status history ───────────────────────────────────────────────────────
do $$ begin
  assert (select count(*) from public.campaign_status_history
          where campaign_id = 'ca000000-0000-0000-0000-000000000001') = 1,
    'insert writes one history row';
end $$;

update public.campaign_status_history set changed_at = '2026-10-01T00:00Z';
update public.campaigns set status = 'paused' where id = 'ca000000-0000-0000-0000-000000000001';
update public.campaign_status_history set changed_at = '2026-10-10T12:00Z'
  where campaign_id = 'ca000000-0000-0000-0000-000000000001' and status = 'paused';
update public.campaigns set status = 'paused' where id = 'ca000000-0000-0000-0000-000000000001';  -- no-op

do $$ begin
  assert (select count(*) from public.campaign_status_history
          where campaign_id = 'ca000000-0000-0000-0000-000000000001') = 2,
    'a status update writes history once, an unchanged status writes nothing';
  assert public.campaign_billable_at('ca000000-0000-0000-0000-000000000001', '2026-10-10T11:59Z'),
    'billable while active';
  assert not public.campaign_billable_at('ca000000-0000-0000-0000-000000000001', '2026-10-10T12:01Z'),
    'not billable after the pause';
  assert not public.campaign_billable_at('ca000000-0000-0000-0000-000000000001', '2026-09-30T12:00Z'),
    'not billable before any history';
  assert not public.campaign_billable_at('ca000000-0000-0000-0000-000000000003', '2026-10-10T12:00Z'),
    'not billable before start_date';
end $$;

-- ── 2. Usage per block ─────────────────────────────────────────────────────
-- Block 11:50–12:00: 30 plays of Camp One (active) and 10 of an unmatched
-- program; block 12:00–12:10: 30 plays of Camp One after the pause; one play
-- with a clock ahead of its upload; one late upload from 09:00.
insert into public.play_logs (device_id, campaign_id, program_name, began_at, duration_seconds, lat, lng, received_at)
select 'dev-1', 'ca000000-0000-0000-0000-000000000001', 'Camp One',
       timestamptz '2026-10-10T11:50:00Z' + make_interval(secs => g * 19),
       10,
       case when g < 20 then 41.7300 else 41.8100 end,
       case when g < 20 then 44.7600 else 44.7600 end,
       timestamptz '2026-10-10T12:01:00Z'
from generate_series(0, 29) g;

insert into public.play_logs (device_id, campaign_id, program_name, began_at, duration_seconds, received_at)
select 'dev-1', null, 'Other', timestamptz '2026-10-10T11:50:05Z' + make_interval(secs => g * 50), 10,
       timestamptz '2026-10-10T12:01:00Z'
from generate_series(0, 9) g;

insert into public.play_logs (device_id, campaign_id, program_name, began_at, duration_seconds, received_at)
select 'dev-1', 'ca000000-0000-0000-0000-000000000001', 'Camp One',
       timestamptz '2026-10-10T12:00:00Z' + make_interval(secs => g * 19), 10,
       timestamptz '2026-10-10T12:11:00Z'
from generate_series(0, 29) g;

insert into public.play_logs (device_id, campaign_id, program_name, began_at, duration_seconds, received_at) values
  ('dev-1', 'ca000000-0000-0000-0000-000000000001', 'Camp One Future', '2026-10-10T11:58:00Z', 10, '2026-10-10T11:40:00Z'),
  ('dev-1', 'ca000000-0000-0000-0000-000000000001', 'Camp One', '2026-10-10T09:03:00Z', 10, '2026-10-10T12:05:00Z');

do $$
declare
  v record;
begin
  select * into v from public.billing_block_usage('2026-10-10T11:50Z', '2026-10-10T12:10Z', null, null, 10)
  where block_start = '2026-10-10T11:50Z' and program_name = 'Camp One';
  assert v.plays = 30 and v.billable_plays = 30 and v.typical_seconds = 10, 'active block: all plays billable';

  select * into v from public.billing_block_usage('2026-10-10T11:50Z', '2026-10-10T12:10Z', null, null, 10)
  where block_start = '2026-10-10T11:50Z' and program_name = 'Other';
  assert v.plays = 10 and v.billable_plays = 0 and v.campaign_id is null, 'unmatched plays count, never bill';

  select * into v from public.billing_block_usage('2026-10-10T11:50Z', '2026-10-10T12:10Z', null, null, 10)
  where block_start = '2026-10-10T12:00Z' and program_name = 'Camp One';
  assert v.plays = 30 and v.billable_plays = 0, 'plays after the pause are not billable';

  assert not exists (
    select 1 from public.billing_block_usage('2026-10-10T11:50Z', '2026-10-10T12:10Z', null, null, 10)
    where program_name = 'Camp One Future'
  ), 'a clock ahead of the upload is not trusted';

  assert not exists (
    select 1 from public.billing_block_usage('2026-10-10T11:50Z', '2026-10-10T12:10Z', null, null, 10)
    where block_start = '2026-10-10T09:00Z'
  ), 'old blocks are not candidates without a late upload';

  select * into v from public.billing_block_usage(
    '2026-10-10T11:50Z', '2026-10-10T12:10Z', '2026-10-10T12:04Z', '2026-10-03T00:00Z', 10)
  where block_start = '2026-10-10T09:00Z';
  assert v.plays = 1 and v.billable_plays = 1, 'a late upload brings its block back in';

  assert not exists (
    select 1 from public.billing_block_usage('2026-10-10T11:50Z', '2026-10-10T12:00Z', null, null, 10)
    where block_start = '2026-10-10T12:00Z'
  ), 'blocks at or after p_to are not candidates';

  select * into v from public.billing_block_usage('2026-10-10T11:00Z', '2026-10-10T13:00Z', null, null, 60)
  where block_start = '2026-10-10T11:00Z' and program_name = 'Camp One';
  assert v.plays = 30, 'hourly blocks bin the same plays by hour';
end $$;

-- ── 3. Positions per block ─────────────────────────────────────────────────
do $$
declare
  v record;
begin
  select count(*) as points, max(n) as top, min(n) as low into v
  from public.billing_block_positions('2026-10-10T11:50Z', '2026-10-10T12:00Z', null, null, 10)
  where device_id = 'dev-1' and block_start = '2026-10-10T11:50Z';
  assert v.points = 2 and v.top = 20 and v.low = 10, 'positions are rounded points with counts';

  -- 12:00 block has no fixes of its own: nearest play fix within 10 minutes.
  select count(*) as points into v
  from public.billing_block_positions('2026-10-10T12:00Z', '2026-10-10T12:10Z', null, null, 10)
  where device_id = 'dev-1' and block_start = '2026-10-10T12:00Z';
  assert v.points = 1, 'a block without fixes borrows the nearest one';
end $$;

-- ── 4. Posting ─────────────────────────────────────────────────────────────
do $$
declare
  v_res jsonb;
  v_rows jsonb := '[
    {"campaign_id":"ca000000-0000-0000-0000-000000000002","device_id":"dev-1","period_start":"2026-10-11T08:00:00Z","period_end":"2026-10-11T08:10:00Z","billing_unit":"block_10m","base_rate":3.4,"district":"Vake","district_tier":1,"district_multiplier":1.45,"time_multiplier":1.3,"plays":30,"expected_plays":30,"loop_seconds":20,"proration":1,"gross_cost":1.068167,"ad_duration_seconds":20},
    {"campaign_id":"ca000000-0000-0000-0000-000000000002","device_id":"dev-1","period_start":"2026-10-11T08:10:00Z","period_end":"2026-10-11T08:20:00Z","billing_unit":"block_10m","base_rate":3.4,"district":"Vake","district_tier":1,"district_multiplier":1.45,"time_multiplier":1.3,"plays":15,"expected_plays":30,"loop_seconds":20,"proration":0.5,"gross_cost":0.534083,"ad_duration_seconds":20}
  ]';
begin
  v_res := public.post_billing_blocks('c0000000-0000-0000-0000-000000000001', v_rows, 'test');
  assert (v_res->>'charged')::numeric = 1.60, 'charges the rounded sum: ' || v_res::text;
  assert (select balance from public.clients where id = 'c0000000-0000-0000-0000-000000000001') = 98.40,
    'balance moved by the charge';
  assert (select count(*) from public.balance_transactions
          where client_id = 'c0000000-0000-0000-0000-000000000001' and type = 'billing') = 1,
    'one ledger row per post';
  assert abs((select carry from public.billing_carry where client_id = 'c0000000-0000-0000-0000-000000000001') - 0.00225) < 0.000001,
    'the remainder carries';

  v_res := public.post_billing_blocks('c0000000-0000-0000-0000-000000000001', v_rows, 'test');
  assert (v_res->>'charged')::numeric = 0 and (v_res->>'rows')::int = 0, 'a repeat run charges nothing';

  -- Late plays raise the half block to a full one: only the difference moves.
  v_rows := jsonb_set(jsonb_set(jsonb_set(v_rows, '{1,plays}', '30'), '{1,proration}', '1'), '{1,gross_cost}', '1.068167');
  v_res := public.post_billing_blocks('c0000000-0000-0000-0000-000000000001', v_rows, 'test');
  assert (v_res->>'rows')::int = 1, 'only the raised row changes';
  assert (v_res->>'charged')::numeric = 0.54, 'charges the delta plus carry: ' || v_res::text;
  assert (select total_cost from public.billing_logs
          where campaign_id = 'ca000000-0000-0000-0000-000000000002' and period_start = '2026-10-11T08:10Z') = 1.068167,
    'the row holds the new exact cost';

  -- Fewer plays never lower a charged row.
  v_rows := jsonb_set(v_rows, '{1,plays}', '10');
  v_res := public.post_billing_blocks('c0000000-0000-0000-0000-000000000001', v_rows, 'test');
  assert (v_res->>'rows')::int = 0, 'lower play counts are ignored';
end $$;

-- Pre-pipeline hourly rows are never re-priced, and blocks never overlap them.
insert into public.billing_logs (client_id, campaign_id, device_id, period_start, period_end, base_rate, total_cost)
values ('c0000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000002', 'dev-1',
        '2026-10-11T07:00Z', '2026-10-11T08:00Z', 3.4, 3.4);

do $$
declare
  v_res jsonb;
begin
  v_res := public.post_billing_blocks('c0000000-0000-0000-0000-000000000001', '[
    {"campaign_id":"ca000000-0000-0000-0000-000000000002","device_id":"dev-1","period_start":"2026-10-11T07:00:00Z","period_end":"2026-10-11T08:00:00Z","billing_unit":"slot_hour","base_rate":3.4,"district":"Vake","district_tier":1,"district_multiplier":1.45,"time_multiplier":1,"plays":99,"expected_plays":1,"loop_seconds":20,"proration":1,"gross_cost":4.93,"ad_duration_seconds":20},
    {"campaign_id":"ca000000-0000-0000-0000-000000000002","device_id":"dev-1","period_start":"2026-10-11T07:10:00Z","period_end":"2026-10-11T07:20:00Z","billing_unit":"block_10m","base_rate":3.4,"district":"Vake","district_tier":1,"district_multiplier":1.45,"time_multiplier":1,"plays":30,"expected_plays":30,"loop_seconds":20,"proration":1,"gross_cost":0.821667,"ad_duration_seconds":20}
  ]', 'test');
  assert (v_res->>'rows')::int = 0 and (v_res->>'charged')::numeric = 0,
    'old rows stay as billed and blocks never overlap an hourly row: ' || v_res::text;

  -- A campaign of another client is skipped.
  v_res := public.post_billing_blocks('c0000000-0000-0000-0000-000000000002', '[
    {"campaign_id":"ca000000-0000-0000-0000-000000000002","device_id":"dev-2","period_start":"2026-10-11T09:00:00Z","period_end":"2026-10-11T09:10:00Z","billing_unit":"block_10m","base_rate":3.4,"district":"Vake","district_tier":1,"district_multiplier":1.45,"time_multiplier":1,"plays":30,"expected_plays":30,"loop_seconds":20,"proration":1,"gross_cost":0.821667,"ad_duration_seconds":20}
  ]', 'test');
  assert (v_res->>'rows')::int = 0, 'rows for another client''s campaign are skipped';
end $$;

-- ── 5. Daily cap ───────────────────────────────────────────────────────────
update public.campaigns set daily_cap = 1.00 where id = 'ca000000-0000-0000-0000-000000000001';
update public.campaigns set status = 'active' where id = 'ca000000-0000-0000-0000-000000000001';

do $$
declare
  v_res jsonb;
  v_row text := '{"campaign_id":"ca000000-0000-0000-0000-000000000001","device_id":"dev-2","period_end":"2026-10-12T00:00:00Z","billing_unit":"block_10m","base_rate":2,"district":"Unknown","district_tier":4,"district_multiplier":1,"time_multiplier":1,"plays":60,"expected_plays":60,"loop_seconds":10,"proration":1,"gross_cost":0.5,"ad_duration_seconds":10';
begin
  -- 21:00–21:20 UTC on the 11th is 01:00–01:20 on the 12th in Tbilisi.
  v_res := public.post_billing_blocks('c0000000-0000-0000-0000-000000000001', (
    '[' || v_row || ',"period_start":"2026-10-11T21:00:00Z"},'
        || v_row || ',"period_start":"2026-10-11T21:10:00Z"},'
        || v_row || ',"period_start":"2026-10-11T21:20:00Z"}]')::jsonb, 'cap test');
  assert (v_res->>'exact')::numeric = 1.00, 'spend stops at the cap: ' || v_res::text;
  assert (v_res->'capped') ? 'ca000000-0000-0000-0000-000000000001', 'the capped campaign is reported';
  assert (select status from public.campaigns where id = 'ca000000-0000-0000-0000-000000000001') = 'paused_cap',
    'the capped campaign is paused for the day';
  assert (select total_cost from public.billing_logs
          where campaign_id = 'ca000000-0000-0000-0000-000000000001' and period_start = '2026-10-11T21:20Z') = 0,
    'airtime over the cap is recorded at zero';

  -- 19:50 UTC on the 11th is 23:50 on the 11th in Tbilisi: a different day.
  v_res := public.post_billing_blocks('c0000000-0000-0000-0000-000000000001', (
    '[' || v_row || ',"period_start":"2026-10-11T19:50:00Z"}]')::jsonb, 'cap test');
  assert (v_res->>'exact')::numeric = 0.5, 'the cap is per Tbilisi day: ' || v_res::text;
end $$;

-- ── 6. Views ───────────────────────────────────────────────────────────────
do $$
declare
  v record;
begin
  assert (select reloptions::text from pg_class where relname = 'billing_hourly') like '%security_invoker=true%',
    'billing_hourly runs with the caller''s RLS';
  assert (select reloptions::text from pg_class where relname = 'billing_daily_totals') like '%security_invoker=true%',
    'billing_daily_totals runs with the caller''s RLS';

  select * into v from public.billing_hourly
  where campaign_id = 'ca000000-0000-0000-0000-000000000002' and hour_start = '2026-10-11T08:00Z';
  assert v.blocks = 2 and v.total_cost = 2.136334 and v.campaign_name = 'Camp Two',
    'blocks fold into their hour';
  assert v.coverage = round(2 / 6.0, 4), 'coverage is the share of a full slot-hour';

  select * into v from public.billing_hourly
  where campaign_id = 'ca000000-0000-0000-0000-000000000002' and hour_start = '2026-10-11T07:00Z';
  assert v.blocks = 1 and v.coverage = 1.0 and v.total_cost = 3.4, 'old hourly rows map one to one';
end $$;

-- ── 7. Retention ───────────────────────────────────────────────────────────
do $$
declare
  v_before numeric;
  v_after  numeric;
  v_moved  int;
begin
  select sum(total_cost) into v_before from public.billing_daily_totals;
  v_moved := public.rollup_billing_logs('2026-10-12');
  select sum(total_cost) into v_after from public.billing_daily_totals;
  assert v_moved > 0, 'rollup moves old detail';
  assert v_before = v_after, 'rollup keeps the totals: ' || v_before || ' vs ' || v_after;
  assert not exists (select 1 from public.billing_logs where period_start < '2026-10-11T20:00Z'),
    'detail before the cutoff is gone';

  begin
    perform public.prune_play_logs(now() - interval '1 day');
    assert false, 'pruning recent play logs must be refused';
  exception when raise_exception then
    null;
  end;
end $$;

-- ── 8. Balance guard still holds for non-service callers ───────────────────
set local request.jwt.claims = '{"role":"authenticated"}';
do $$ begin
  begin
    perform public.post_billing_blocks('c0000000-0000-0000-0000-000000000002', '[
      {"campaign_id":"ca000000-0000-0000-0000-000000000003","device_id":"dev-2","period_start":"2026-11-02T09:00:00Z","period_end":"2026-11-02T09:10:00Z","billing_unit":"block_10m","base_rate":2,"district":"Unknown","district_tier":4,"district_multiplier":1,"time_multiplier":1,"plays":60,"expected_plays":60,"loop_seconds":10,"proration":1,"gross_cost":0.333333,"ad_duration_seconds":10},
      {"campaign_id":"ca000000-0000-0000-0000-000000000003","device_id":"dev-2","period_start":"2026-11-02T09:10:00Z","period_end":"2026-11-02T09:20:00Z","billing_unit":"block_10m","base_rate":2,"district":"Unknown","district_tier":4,"district_multiplier":1,"time_multiplier":1,"plays":60,"expected_plays":60,"loop_seconds":10,"proration":1,"gross_cost":0.333333,"ad_duration_seconds":10}
    ]', 'test');
    assert false, 'a non-service caller must not move a balance';
  exception when raise_exception then
    null;
  end;
end $$;

rollback;

\echo 010 scenarios: all passed
