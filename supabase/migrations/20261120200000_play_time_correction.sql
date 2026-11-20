-- Correct plays stamped with an impossible date, and keep the original stamp.
--
-- A controller whose clock battery isn't working boots on a default date
-- (3 Jul 2026 14:35) until the internet sets the time, so its first play or
-- two land on the wrong day in client reports. From now on the play-log
-- callback moves such plays to just before their upload (src/lib/play-times.ts)
-- and keeps the controller's stamp in reported_began_at. This migration adds
-- the column, makes the clock warning read the controller's stamp, and applies
-- the same correction to the plays already stored.

alter table public.play_logs
  add column if not exists reported_began_at timestamptz;

comment on column public.play_logs.reported_began_at is
  'The controller''s own stamp, set only when it was impossible and began_at was corrected.';

-- Lets the callback spot a resent batch whose plays were already corrected.
create index if not exists idx_play_logs_reported
  on public.play_logs (device_id, reported_began_at)
  where reported_began_at is not null;

-- ── Clock warning reads the controller's stamp ────────────────────────────────
create or replace view public.device_clock_issues
with (security_invoker = true) as
with bad as (
  select
    device_id,
    count(*)::int                                                            as bad_plays,
    max(received_at)                                                         as last_bad_at,
    (array_agg(coalesce(reported_began_at, began_at) order by received_at desc))[1] as last_bad_stamp
  from public.play_logs
  where received_at > now() - interval '7 days'
    and (coalesce(reported_began_at, began_at) > received_at + interval '10 minutes'
         or coalesce(reported_began_at, began_at) < received_at - interval '30 days')
  group by device_id
),
boot as (
  select
    b.device_id,
    r.restarted_at,
    (select max(d.occurred_at)
       from public.system_events d
      where d.device_id = b.device_id
        and d.kind = 'disconnected'
        and d.occurred_at < r.restarted_at) as went_offline_at
  from bad b
  left join lateral (
    select max(e.occurred_at) as restarted_at
      from public.system_events e
     where e.device_id = b.device_id and e.kind = 'restarted'
  ) r on true
)
select
  b.device_id,
  b.bad_plays,
  b.last_bad_at,
  b.last_bad_stamp,
  boot.restarted_at                                                   as last_restart_at,
  extract(epoch from boot.restarted_at - boot.went_offline_at)::int   as last_restart_offline_s,
  coalesce(
    boot.restarted_at > b.last_bad_at + interval '5 minutes'
    and boot.restarted_at - boot.went_offline_at >= interval '30 minutes'
    and exists (
      select 1 from public.play_logs p
       where p.device_id = b.device_id
         and p.received_at > boot.restarted_at + interval '2 minutes'
    ),
    false
  )                                                                   as resolved
from bad b
join boot using (device_id);

revoke all on public.device_clock_issues from anon;
grant select on public.device_clock_issues to authenticated, service_role;

-- ── Correct the plays already stored ──────────────────────────────────────────
-- Same rule as the callback: plays uploaded together keep their spacing, and
-- the last of them ends just before the upload arrived.
with bad as (
  select id, device_id, received_at, began_at, duration_seconds
    from public.play_logs
   where reported_began_at is null
     and (began_at > received_at + interval '10 minutes'
          or began_at < received_at - interval '30 days')
),
batch as (
  select device_id, received_at,
         max(began_at + duration_seconds * interval '1 second') as latest_end
    from bad
   group by device_id, received_at
)
update public.play_logs p
   set reported_began_at = p.began_at,
       began_at          = p.began_at + (batch.received_at - batch.latest_end)
  from bad
  join batch using (device_id, received_at)
 where p.id = bad.id;

-- ── Recount the days those plays left and joined ──────────────────────────────
with affected as (
  select distinct campaign_id, (stamp at time zone 'Asia/Tbilisi')::date as day
    from (
      select campaign_id, reported_began_at as stamp from public.play_logs where reported_began_at is not null
      union all
      select campaign_id, began_at            from public.play_logs where reported_began_at is not null
    ) s
   where campaign_id is not null
),
counts as (
  select a.campaign_id, a.day,
         count(p.id)                            as plays,
         coalesce(sum(p.duration_seconds), 0)   as seconds,
         count(distinct p.device_id)            as taxis
    from affected a
    left join public.play_logs p
      on p.campaign_id = a.campaign_id
     and p.began_at >= (a.day::timestamp       at time zone 'Asia/Tbilisi')
     and p.began_at <  ((a.day + 1)::timestamp at time zone 'Asia/Tbilisi')
   group by a.campaign_id, a.day
),
emptied as (
  delete from public.play_stats s
   using counts c
   where s.campaign_id = c.campaign_id and s.date = c.day and c.plays = 0
)
insert into public.play_stats (campaign_id, date, play_count, total_duration_seconds, unique_taxis, km_covered)
select campaign_id, day, plays, seconds, greatest(taxis, 1), 0
  from counts
 where plays > 0
on conflict (campaign_id, date) do update
   set play_count             = excluded.play_count,
       total_duration_seconds = excluded.total_duration_seconds,
       unique_taxis           = excluded.unique_taxis;
