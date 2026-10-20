-- Optional daily-cap control for advertisers. Requires 010 and the verified
-- session forward migration. Never grants clients general campaign UPDATE.
create or replace function public.set_my_campaign_daily_cap(p_campaign_id uuid, p_daily_cap numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null or not gzad_auth.session_is_verified() then
    raise exception 'Verified authentication required' using errcode = '42501';
  end if;
  if p_daily_cap is not null and (
    p_daily_cap <= 0 or p_daily_cap > 99999999.99 or p_daily_cap <> round(p_daily_cap, 2)
  ) then
    raise exception 'Invalid daily limit' using errcode = '22023';
  end if;

  update public.campaigns c set daily_cap = p_daily_cap
  where c.id = p_campaign_id
    and exists (
      select 1 from public.clients cl
      where cl.id = c.client_id and cl.auth_user_id = (select auth.uid()) and cl.role = 'client'
    )
  returning jsonb_build_object('daily_cap', c.daily_cap, 'status', c.status) into v_result;

  if v_result is null then
    raise exception 'Campaign not found or forbidden' using errcode = '42501';
  end if;
  -- Editing a cap never approves, activates or resumes a campaign. A cap-paused
  -- campaign resumes through the existing next-Tbilisi-day billing path.
  return v_result;
end;
$$;

revoke all on function public.set_my_campaign_daily_cap(uuid, numeric) from public, anon, authenticated, service_role;
grant execute on function public.set_my_campaign_daily_cap(uuid, numeric) to authenticated;
