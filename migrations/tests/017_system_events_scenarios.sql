-- Local-only, rolled-back proof of who can see and write the activity log.
-- Run with tests/run-local.sh against a disposable PostgreSQL cluster only.
begin;

alter role service_role bypassrls;
set local request.jwt.claims = '{"role":"service_role"}';

insert into auth.users(id) values
  ('e1111111-1111-4111-8111-111111111111'),
  ('e9999999-9999-4999-8999-999999999999');
insert into public.clients(id,auth_user_id,email,company_name,contact_name,is_admin,role) values
  ('f1111111-1111-4111-8111-111111111111','e1111111-1111-4111-8111-111111111111','events-client@example.invalid','Events client','C',false,'client'),
  ('f9999999-9999-4999-8999-999999999999','e9999999-9999-4999-8999-999999999999','events-admin@example.invalid','Events admin','A',true,'admin');
insert into public.auth_verified_sessions(session_id,user_id,device_hash,ip_hash,agent_hash,verified_at,expires_at) values
  ('c1111111-1111-4111-8111-111111111111','e1111111-1111-4111-8111-111111111111',repeat('a',64),repeat('b',64),repeat('c',64),now(),now()+interval '1 day'),
  ('c9999999-9999-4999-8999-999999999999','e9999999-9999-4999-8999-999999999999',repeat('a',64),repeat('b',64),repeat('c',64),now(),now()+interval '1 day');

-- The service role (billing route, device callbacks) writes freely.
set local role service_role;
insert into public.system_events(category, kind, severity, title, device_id, detail) values
  ('billing', 'billing_run', 'success', 'Billing: ₾2.88 charged', null, '{"charged": 2.88}'),
  ('screen', 'connected', 'success', 'y1c-825-61009 connected', 'y1c-825-61009', '{}');
do $$ begin
  begin
    insert into public.system_events(category, kind, title) values ('nonsense', 'x', 'bad category');
    raise exception 'unknown category accepted';
  exception when check_violation then null;
  end;
end $$;

-- A verified admin reads the whole log.
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"e9999999-9999-4999-8999-999999999999","session_id":"c9999999-9999-4999-8999-999999999999"}';
do $$ begin
  assert (select count(*) from public.system_events) = 2, 'verified admin reads every event';
  begin
    insert into public.system_events(category, kind, title) values ('system', 'forged', 'admin browser write');
    raise exception 'admin browser wrote an event';
  exception when insufficient_privilege then null;
  end;
end $$;

-- An admin whose session isn't verified sees nothing.
set local request.jwt.claims = '{"role":"authenticated","sub":"e9999999-9999-4999-8999-999999999999","session_id":"c0000000-0000-4000-8000-000000000000"}';
do $$ begin assert (select count(*) from public.system_events) = 0, 'unverified admin session reads nothing'; end $$;

-- Clients and anonymous visitors never see staff activity.
set local request.jwt.claims = '{"role":"authenticated","sub":"e1111111-1111-4111-8111-111111111111","session_id":"c1111111-1111-4111-8111-111111111111"}';
do $$ begin assert (select count(*) from public.system_events) = 0, 'clients cannot read the activity log'; end $$;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$ begin assert (select count(*) from public.system_events) = 0, 'anonymous visitors cannot read the activity log'; end $$;

reset role;
rollback;

\echo 017 system events scenarios: all passed
