-- Local-only, rolled-back proof of the real ownership/admin/storage policies.
-- A native password grant is represented by its genuine JWT claim shape.
-- Run with tests/run-local.sh against a disposable PostgreSQL cluster only.
begin;

-- Match Supabase's service role in the local fixture. This role alteration and
-- all grants/data below roll back; production roles are never touched.
alter role service_role bypassrls;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
set local request.jwt.claims = '{"role":"service_role"}';

insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('99999999-9999-4999-8999-999999999999');
insert into public.clients(id,auth_user_id,email,company_name,contact_name,is_admin,role,balance) values
  ('a1111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','auth-proof-a@example.invalid','Auth A','A',false,'client',100),
  ('a2222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','auth-proof-b@example.invalid','Auth B','B',false,'client',100),
  ('a9999999-9999-4999-8999-999999999999','99999999-9999-4999-8999-999999999999','auth-proof-admin@example.invalid','Auth admin','Admin',true,'admin',0);
insert into public.campaigns(id,client_id,name,status) values
  ('b1111111-1111-4111-8111-111111111111','a1111111-1111-4111-8111-111111111111','Auth proof A','draft'),
  ('b2222222-2222-4222-8222-222222222222','a2222222-2222-4222-8222-222222222222','Auth proof B','draft');
insert into public.billing_logs(client_id,campaign_id,device_id,period_start,period_end,base_rate,total_cost) values
  ('a1111111-1111-4111-8111-111111111111','b1111111-1111-4111-8111-111111111111','auth-proof-screen','2026-10-20T10:00Z','2026-10-20T11:00Z',2,2),
  ('a2222222-2222-4222-8222-222222222222','b2222222-2222-4222-8222-222222222222','auth-proof-screen','2026-10-20T10:00Z','2026-10-20T11:00Z',2,2);
insert into storage.objects(bucket_id,name) values ('ad-media','public-existing-ad.mp4');

insert into public.auth_verified_sessions(session_id,user_id,device_hash,ip_hash,agent_hash,verified_at,expires_at) values
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',repeat('a',64),repeat('b',64),repeat('c',64),now(),now()+interval '180 days'),
  ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222',repeat('d',64),repeat('e',64),repeat('f',64),now(),now()+interval '180 days'),
  ('66666666-6666-4666-8666-666666666666','11111111-1111-4111-8111-111111111111',repeat('a',64),repeat('b',64),repeat('c',64),now()-interval '2 days',now()-interval '1 day'),
  ('77777777-7777-4777-8777-777777777777','99999999-9999-4999-8999-999999999999',repeat('a',64),repeat('b',64),repeat('c',64),now(),now()+interval '180 days');

-- No approved native session: password success alone reveals no private data,
-- even if the same user has previously approved another session.
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","session_id":"44444444-4444-4444-8444-444444444444"}';
do $$ begin
  assert not gzad_auth.session_is_verified(), 'fresh public password grant must be unapproved';
  assert (select count(*) from public.clients) = 0, 'unapproved own profile must be hidden';
  assert (select count(*) from public.campaigns) = 0, 'unapproved own campaigns must be hidden';
  assert (select count(*) from public.billing_hourly) = 0, 'unapproved hourly view must be hidden';
  assert (select count(*) from public.billing_daily_totals) = 0, 'unapproved daily view must be hidden';
  assert (select count(*) from storage.objects) = 1, 'existing public advertising remains readable';
  begin
    insert into public.campaigns(client_id,name,status) values ('a1111111-1111-4111-8111-111111111111','Unverified insertion','draft');
    raise exception 'unapproved campaign insertion succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.auth_verified_sessions(session_id,user_id,device_hash,ip_hash,agent_hash,expires_at)
      values ('88888888-8888-4888-8888-888888888888','11111111-1111-4111-8111-111111111111',repeat('a',64),repeat('b',64),repeat('c',64),now()+interval '1 day');
    raise exception 'browser approved its own session';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Completing verification permits only the existing owner's data.
set local request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","session_id":"33333333-3333-4333-8333-333333333333"}';
do $$ begin
  assert gzad_auth.session_is_verified(), 'approved native session must pass';
  assert (select count(*) from public.clients) = 1, 'approved owner sees one profile without recursive RLS';
  assert (select id from public.clients) = 'a1111111-1111-4111-8111-111111111111', 'approved owner sees own profile';
  assert (select count(*) from public.campaigns) = 1, 'approved owner sees only own campaign';
  assert (select count(*) from public.billing_hourly) = 1, 'hourly view preserves ownership after approval';
  assert (select sum(total_cost) from public.billing_daily_totals) = 2, 'daily view preserves ownership after approval';
end $$;
insert into storage.objects(bucket_id,name) values ('ad-media','a1111111-1111-4111-8111-111111111111/verified-ad.mp4');

-- User B cannot reuse user A's approved session_id.
set local request.jwt.claims = '{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222","session_id":"33333333-3333-4333-8333-333333333333"}';
do $$ begin
  assert not gzad_auth.session_is_verified(), 'session approval must belong to the JWT user';
  assert (select count(*) from public.clients) = 0, 'cross-user session reveals nothing';
end $$;
set local request.jwt.claims = '{"role":"authenticated","sub":"22222222-2222-4222-8222-222222222222","session_id":"55555555-5555-4555-8555-555555555555"}';
do $$ begin
  assert (select id from public.clients) = 'a2222222-2222-4222-8222-222222222222', 'approved B still cannot see A';
end $$;

-- Expired or missing native session ids cannot reuse a previous approval.
set local request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","session_id":"66666666-6666-4666-8666-666666666666"}';
do $$ begin
  assert not gzad_auth.session_is_verified(), 'expired approval must fail closed';
  assert (select count(*) from public.clients) = 0, 'expired approval reveals nothing';
end $$;
set local request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}';
do $$ begin assert not gzad_auth.session_is_verified(), 'missing native session id must fail closed'; end $$;

-- An admin also needs an approved session; approval preserves staff rights.
set local request.jwt.claims = '{"role":"authenticated","sub":"99999999-9999-4999-8999-999999999999","session_id":"44444444-4444-4444-8444-444444444444"}';
do $$ begin
  assert (select count(*) from public.clients) = 0, 'unapproved admin grant reveals no client data';
  begin
    insert into storage.objects(bucket_id,name) values ('ad-media','admin/unverified-ad.mp4');
    raise exception 'unapproved admin uploaded an ad';
  exception when insufficient_privilege then null;
  end;
end $$;
set local request.jwt.claims = '{"role":"authenticated","sub":"99999999-9999-4999-8999-999999999999","session_id":"77777777-7777-4777-8777-777777777777"}';
do $$ begin
  assert (select count(*) from public.clients) = 3, 'approved admin retains all-client access';
  assert (select count(*) from public.campaigns) = 2, 'approved admin retains campaign access';
end $$;
insert into storage.objects(bucket_id,name) values ('ad-media','admin/verified-ad.mp4');

-- Internal billing writes use the service role and remain independent of a
-- browser or native user session. The balance guard and ledger still work.
reset role;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
update public.clients set balance = balance - 2 where id = 'a1111111-1111-4111-8111-111111111111';
insert into public.balance_transactions(client_id,amount,balance_after,type,note)
  values ('a1111111-1111-4111-8111-111111111111',-2,98,'billing','Auth trust RLS proof');
do $$ begin
  assert (select balance from public.clients where id = 'a1111111-1111-4111-8111-111111111111') = 98, 'service billing balance update survives restrictive RLS';
  assert (select count(*) from public.balance_transactions where note = 'Auth trust RLS proof') = 1, 'service billing ledger write survives restrictive RLS';
end $$;

reset role;
-- Removing session approval at logout closes data access while browser trust
-- may be kept for the next password login by the application.
delete from public.auth_verified_sessions where session_id = '33333333-3333-4333-8333-333333333333';
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111","session_id":"33333333-3333-4333-8333-333333333333"}';
do $$ begin assert (select count(*) from public.clients) = 0, 'revoked native session must immediately lose data access'; end $$;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$ begin
  assert (select count(*) from public.clients) = 0, 'anonymous user has no profile access';
  assert (select count(*) from storage.objects) = 3, 'public taxi advertisements stay readable anonymously';
end $$;

reset role;
do $$ begin
  assert (select count(*) from pg_policies where schemaname = 'public' and policyname = 'Verified session required' and permissive = 'RESTRICTIVE') = 20,
    'every existing private app table (19, plus system_events) has a restrictive session gate';
  assert not has_function_privilege('anon','gzad_auth.session_is_verified()','EXECUTE'), 'anonymous users cannot execute private trust lookup';
  assert not has_table_privilege('authenticated','public.auth_verified_sessions','INSERT'), 'authenticated users cannot approve sessions';
end $$;
rollback;
