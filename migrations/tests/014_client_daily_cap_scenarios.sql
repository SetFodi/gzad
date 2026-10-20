-- Real-role mutation checks for the client daily-cap RPC. Disposable local DB.
begin;
set local request.jwt.claims = '{"role":"service_role"}';
insert into auth.users (id) values
  ('dc000000-0000-0000-0000-000000000001'), ('dc000000-0000-0000-0000-000000000002');
insert into public.clients (id, auth_user_id, email, company_name, contact_name, role, balance) values
  ('dc100000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-000000000001', 'cap-owner@test', 'Owner', 'Owner', 'client', 100),
  ('dc100000-0000-0000-0000-000000000002', 'dc000000-0000-0000-0000-000000000002', 'cap-other@test', 'Other', 'Other', 'client', 100);
insert into public.campaigns (id, client_id, name, status, daily_cap) values
  ('dc200000-0000-0000-0000-000000000001', 'dc100000-0000-0000-0000-000000000001', 'Cap Owner', 'paused_cap', 10),
  ('dc200000-0000-0000-0000-000000000002', 'dc100000-0000-0000-0000-000000000002', 'Cap Other', 'active', 20);
insert into public.auth_verified_sessions (session_id, user_id, device_hash, ip_hash, agent_hash, expires_at)
values ('dc300000-0000-0000-0000-000000000001', 'dc000000-0000-0000-0000-000000000001', repeat('a', 64), repeat('b', 64), repeat('c', 64), now() + interval '1 day');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"dc000000-0000-0000-0000-000000000001","session_id":"dc300000-0000-0000-0000-000000000001"}';
do $$
declare v jsonb;
begin
  v := public.set_my_campaign_daily_cap('dc200000-0000-0000-0000-000000000001', 25.25);
  assert (v->>'daily_cap')::numeric = 25.25, 'verified owner can set an exact cap';
  assert v->>'status' = 'paused_cap', 'raising a cap never resumes a campaign';

  begin
    perform public.set_my_campaign_daily_cap('dc200000-0000-0000-0000-000000000002', 1);
    raise exception 'other client campaign was modified';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_my_campaign_daily_cap('dc200000-0000-0000-0000-000000000001', -1);
    raise exception 'negative cap accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_my_campaign_daily_cap('dc200000-0000-0000-0000-000000000001', 1.001);
    raise exception 'sub-tetri cap accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_my_campaign_daily_cap('dc200000-0000-0000-0000-000000000001', 'NaN'::numeric);
    raise exception 'NaN cap accepted';
  exception when invalid_parameter_value then null;
  end;

  v := public.set_my_campaign_daily_cap('dc200000-0000-0000-0000-000000000001', null);
  assert v->'daily_cap' = 'null'::jsonb, 'owner can keep the optional limit unset';
  assert v->>'status' = 'paused_cap', 'removing a cap does not approve or resume an ad';
end $$;

-- Possession of a native Supabase password/OTP session alone is insufficient.
set local request.jwt.claims = '{"role":"authenticated","sub":"dc000000-0000-0000-0000-000000000001","session_id":"dc300000-0000-0000-0000-000000000099"}';
do $$ begin
  begin
    perform public.set_my_campaign_daily_cap('dc200000-0000-0000-0000-000000000001', 50);
    raise exception 'unverified native session changed the cap';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
do $$ begin
  assert (select daily_cap from public.campaigns where id = 'dc200000-0000-0000-0000-000000000001') is null,
    'only owner cap changes were persisted';
  assert (select daily_cap from public.campaigns where id = 'dc200000-0000-0000-0000-000000000002') = 20,
    'other client cap is unchanged';
  assert (select status from public.campaigns where id = 'dc200000-0000-0000-0000-000000000001') = 'paused_cap',
    'no status mutation';
  assert not has_function_privilege('anon', 'public.set_my_campaign_daily_cap(uuid,numeric)', 'EXECUTE'),
    'anonymous callers cannot update caps';
end $$;
rollback;
