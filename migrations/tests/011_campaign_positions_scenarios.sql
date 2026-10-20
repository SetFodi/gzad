-- Team GPS decision. Everything rolls back in a disposable local database.
begin;
set local request.jwt.claims = '{"role":"service_role"}';

insert into public.clients (id, email, company_name, contact_name, balance)
values ('f0000000-0000-0000-0000-000000000001', 'positions@test', 'Positions', 'Positions', 100);
insert into public.campaigns (id, client_id, name, status, slot_duration) values
  ('f1000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Ad A', 'active', 10),
  ('f1000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'Ad B', 'active', 10),
  ('f1000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 'Ad C', 'active', 10);
update public.campaign_status_history set changed_at = '2026-10-01T00:00Z'
where campaign_id::text like 'f1000000-%';

insert into public.play_logs (device_id, campaign_id, program_name, began_at, duration_seconds, lat, lng, received_at) values
  -- The same ad's earlier playback is more than ten minutes old. It is eligible.
  ('positions-1', 'f1000000-0000-0000-0000-000000000001', 'Ad A', '2026-10-15T06:00Z', 10, 41.73, 44.75, '2026-10-15T06:01Z'),
  -- A different screen, a different ad and a different creative cannot replace it.
  ('positions-2', 'f1000000-0000-0000-0000-000000000001', 'Ad A', '2026-10-15T07:59Z', 10, 41.81, 44.76, '2026-10-15T08:00Z'),
  ('positions-1', 'f1000000-0000-0000-0000-000000000002', 'Ad B', '2026-10-15T07:59Z', 10, 41.81, 44.76, '2026-10-15T08:00Z'),
  ('positions-1', 'f1000000-0000-0000-0000-000000000001', 'Ad A revised', '2026-10-15T07:59Z', 10, 41.81, 44.76, '2026-10-15T08:00Z'),
  -- The actual block: A lacks GPS; B has its own valid position; C has no earlier position.
  ('positions-1', 'f1000000-0000-0000-0000-000000000001', 'Ad A', '2026-10-15T08:01Z', 10, 0, 0, '2026-10-15T08:11Z'),
  ('positions-1', 'f1000000-0000-0000-0000-000000000002', 'Ad B', '2026-10-15T08:02Z', 10, 41.81, 44.76, '2026-10-15T08:11Z'),
  ('positions-1', 'f1000000-0000-0000-0000-000000000003', 'Ad C', '2026-10-15T08:03Z', 10, null, null, '2026-10-15T08:11Z'),
  -- A's later playback must not be used to locate its earlier missing fix.
  ('positions-1', 'f1000000-0000-0000-0000-000000000001', 'Ad A', '2026-10-15T08:05Z', 10, 41.81, 44.76, '2026-10-15T08:11Z'),
  -- C has only a later location outside the block. It must remain unlocated.
  ('positions-1', 'f1000000-0000-0000-0000-000000000003', 'Ad C', '2026-10-15T08:11Z', 10, 41.81, 44.76, '2026-10-15T08:12Z');

do $$ begin
  assert exists (
    select 1 from public.billing_campaign_positions('2026-10-15T08:00Z', '2026-10-15T08:10Z', null, null, 10)
    where campaign_id = 'f1000000-0000-0000-0000-000000000001' and lat = 41.730 and n = 1
  ), 'A uses its earlier same-screen same-creative position, never a later/different-ad fix';
  assert exists (
    select 1 from public.billing_campaign_positions('2026-10-15T08:00Z', '2026-10-15T08:10Z', null, null, 10)
    where campaign_id = 'f1000000-0000-0000-0000-000000000001' and lat = 41.810 and n = 1
  ), 'A retains the valid GPS of its later actual play';
  assert exists (
    select 1 from public.billing_campaign_positions('2026-10-15T08:00Z', '2026-10-15T08:10Z', null, null, 10)
    where campaign_id = 'f1000000-0000-0000-0000-000000000002' and lat = 41.810 and n = 1
  ), 'B uses its own recorded GPS';
  assert not exists (
    select 1 from public.billing_campaign_positions('2026-10-15T08:00Z', '2026-10-15T08:10Z', null, null, 10)
    where campaign_id = 'f1000000-0000-0000-0000-000000000003'
  ), 'C cannot borrow another ad or a future play location';
  assert not has_function_privilege('authenticated', 'public.billing_campaign_positions(timestamptz,timestamptz,timestamptz,timestamptz,int)', 'EXECUTE'),
    'clients cannot call the service-only position reader';
  assert not has_function_privilege('anon', 'public.billing_campaign_positions(timestamptz,timestamptz,timestamptz,timestamptz,int)', 'EXECUTE'),
    'anonymous callers cannot read campaign positions';
  assert has_function_privilege('service_role', 'public.billing_campaign_positions(timestamptz,timestamptz,timestamptz,timestamptz,int)', 'EXECUTE'),
    'billing service can read campaign positions';
end $$;

-- Paused stale-playlist ads must not influence any billable location vote.
update public.campaigns set status = 'paused' where id = 'f1000000-0000-0000-0000-000000000002';
update public.campaign_status_history set changed_at = '2026-10-15T08:00Z'
where campaign_id = 'f1000000-0000-0000-0000-000000000002' and status = 'paused';
do $$ begin
  assert not exists (
    select 1 from public.billing_campaign_positions('2026-10-15T08:00Z', '2026-10-15T08:10Z', null, null, 10)
    where campaign_id = 'f1000000-0000-0000-0000-000000000002'
  ), 'plays after a pause do not influence billable location';
end $$;
rollback;
