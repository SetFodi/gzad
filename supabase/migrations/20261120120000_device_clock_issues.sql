-- Screens whose clock is wrong, judged from their own play logs.
--
-- A controller stamps every play with its own clock (began_at); the app notes
-- when the log arrived (received_at). A play stamped after it arrived, or
-- months before, is impossible, so the controller's clock was wrong. That is
-- what happens when its CR2032 clock battery is missing or flat: after a power
-- cut it boots on a default date until the internet corrects it.
--
-- A screen that was offline uploads its buffered plays hours or days late,
-- which is fine, so only stamps more than 30 days old count as "behind".
-- security_invoker keeps play_logs' row level security in force.

create or replace view public.device_clock_issues
with (security_invoker = true) as
select
  device_id,
  count(*)::int                                        as bad_plays,
  max(received_at)                                     as last_bad_at,
  (array_agg(began_at order by received_at desc))[1]   as last_bad_stamp
from public.play_logs
where received_at > now() - interval '7 days'
  and (began_at > received_at + interval '10 minutes'
       or began_at < received_at - interval '30 days')
group by device_id;

revoke all on public.device_clock_issues from anon;
grant select on public.device_clock_issues to authenticated, service_role;
