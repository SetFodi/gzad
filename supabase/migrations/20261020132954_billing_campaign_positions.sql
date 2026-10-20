-- Team decision, 2026-10-20. Metered districts follow each ad's recorded plays.
-- A play without GPS may use only an earlier GPS-tagged playback of that same
-- campaign/program on the same screen. No future fixes or other ads' positions.
-- Requires migrations/010_metered_billing.sql. This forward migration does not
-- change the legacy billing_block_positions contract or post any charges.

create index if not exists idx_play_logs_ad_last_fix
  on public.play_logs (device_id, campaign_id, program_name, began_at desc)
  where lat <> 0 and lng <> 0;

create or replace function public.billing_campaign_positions(
  p_from           timestamptz,
  p_to             timestamptz,
  p_received_since timestamptz,
  p_late_from      timestamptz,
  p_block_minutes  int default 10
)
returns table (
  device_id   text,
  campaign_id uuid,
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
  plays as (
    select c.block_start, pl.*
    from candidates c
    join public.play_logs pl
      on pl.device_id = c.device_id
     and pl.began_at >= c.block_start
     and pl.began_at < c.block_start + (select len from step)
    where pl.campaign_id is not null
      and public.campaign_billable_at(pl.campaign_id, pl.began_at)
      and pl.began_at <= pl.received_at + interval '5 minutes'
  ),
  located as (
    select p.device_id, p.campaign_id, p.block_start, p.began_at,
           case when p.lat <> 0 and p.lng <> 0 then p.lat else last_fix.lat end as lat,
           case when p.lat <> 0 and p.lng <> 0 then p.lng else last_fix.lng end as lng
    from plays p
    left join lateral (
      select prior.lat, prior.lng
      from public.play_logs prior
      where (p.lat is null or p.lng is null or p.lat = 0 or p.lng = 0)
        and prior.device_id = p.device_id
        and prior.campaign_id = p.campaign_id
        and prior.program_name = p.program_name
        and prior.lat <> 0 and prior.lng <> 0
        and prior.began_at < p.began_at
        and prior.began_at <= prior.received_at + interval '5 minutes'
      order by prior.began_at desc, prior.id desc
      limit 1
    ) last_fix on true
  )
  select p.device_id, p.campaign_id, p.block_start,
         round(p.lat, 3), round(p.lng, 3), count(*)::int, min(p.began_at)
  from located p
  where p.lat <> 0 and p.lng <> 0
  group by p.device_id, p.campaign_id, p.block_start, round(p.lat, 3), round(p.lng, 3)
  order by p.device_id, p.block_start, p.campaign_id, round(p.lat, 3), round(p.lng, 3)
$$;

revoke all on function public.billing_campaign_positions(timestamptz, timestamptz, timestamptz, timestamptz, int)
  from public, anon, authenticated;
grant execute on function public.billing_campaign_positions(timestamptz, timestamptz, timestamptz, timestamptz, int)
  to service_role;
