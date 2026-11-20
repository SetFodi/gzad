-- Warn only about clocks that stay wrong, not about the boot quirk.
--
-- On 20 Nov y08-s26-60756 kept the right time through a power cut with its SIM
-- out (LEDOK "Cur time of controller"), so its clock battery works, yet its
-- first play or two after every power-on still carried the default date
-- (3 Jul 2026 14:35). Boards with and without a battery do this alike: the
-- player starts before the board has loaded its clock. Those plays are already
-- corrected on arrival (20261120200000), so they need no warning.
--
-- A clock that is really wrong stays wrong for minutes: no working battery and
-- no internet time. Its plays come in a run, so only runs of 5 or more
-- wrong-dated plays, each within 2 minutes of the previous one, count.

create or replace view public.device_clock_issues
with (security_invoker = true) as
with stamped as (
  select device_id, received_at, coalesce(reported_began_at, began_at) as stamp
    from public.play_logs
   where received_at > now() - interval '7 days'
     and (coalesce(reported_began_at, began_at) > received_at + interval '10 minutes'
          or coalesce(reported_began_at, began_at) < received_at - interval '30 days')
),
marked as (
  select *,
         case when received_at - lag(received_at) over (partition by device_id order by received_at)
                   <= interval '2 minutes' then 0 else 1 end as starts_run
    from stamped
),
runs as (
  select *, sum(starts_run) over (partition by device_id order by received_at) as run
    from marked
),
sustained as (
  select r.*
    from runs r
    join (select device_id, run from runs group by device_id, run having count(*) >= 5) big
      using (device_id, run)
),
bad as (
  select device_id,
         count(*)::int                                      as bad_plays,
         max(received_at)                                   as last_bad_at,
         (array_agg(stamp order by received_at desc))[1]    as last_bad_stamp
    from sustained
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
