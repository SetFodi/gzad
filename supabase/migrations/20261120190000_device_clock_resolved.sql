-- Tell when a wrong clock has been fixed, instead of warning for 7 days.
--
-- A screen's clock is proven fixed once it boots after being off for at least
-- 30 minutes and still stamps its plays correctly: the CR2032 battery kept the
-- time. Shorter outages prove nothing: on 17 Nov y08-s26-60759 kept its time
-- through 5 minutes off but lost it after 18, so the board can bridge a few
-- minutes without a battery.
--
--   last_restart_at          latest 'restarted' event (the controller booted)
--   last_restart_offline_s   how long it had been disconnected before that boot
--   resolved                 that boot came well after the last wrong stamp,
--                            followed 30+ minutes offline, and correct plays
--                            have arrived since
--
-- Columns are only appended, so CREATE OR REPLACE keeps the existing ones.

create or replace view public.device_clock_issues
with (security_invoker = true) as
with bad as (
  select
    device_id,
    count(*)::int                                      as bad_plays,
    max(received_at)                                   as last_bad_at,
    (array_agg(began_at order by received_at desc))[1] as last_bad_stamp
  from public.play_logs
  where received_at > now() - interval '7 days'
    and (began_at > received_at + interval '10 minutes'
         or began_at < received_at - interval '30 days')
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
