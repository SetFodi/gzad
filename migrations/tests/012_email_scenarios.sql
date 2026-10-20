-- Delivery claims use real Postgres, no provider requests. Everything rolls back.
begin;
set local request.jwt.claims = '{"role":"service_role"}';

insert into public.clients (id, email, company_name, contact_name, balance)
values ('e0000000-0000-0000-0000-000000000001', 'email-test@example.com', 'Email test', 'Email test', 10);
insert into public.billing_alerts (id, client_id, kind, balance, detail, dedupe_key, created_at)
values ('ea000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'low_20pct', 10,
        '{"pct":20}', 'email-test-alert', now());

do $$
declare
  v_claim jsonb;
  v_second jsonb;
  v_payload jsonb := '{"from":"billing@example.com","to":["client@example.com"],"subject":"Low balance","text":"Balance 10"}';
begin
  assert not has_function_privilege('anon', 'public.claim_billing_alert_email(uuid,jsonb)', 'execute');
  assert not has_function_privilege('authenticated', 'public.finish_billing_alert_email(uuid,uuid,text,text)', 'execute');
  assert has_function_privilege('service_role', 'public.claim_billing_alert_email(uuid,jsonb)', 'execute');

  v_claim := public.claim_billing_alert_email('ea000000-0000-0000-0000-000000000001', v_payload);
  assert v_claim->'payload' = v_payload, 'first claim freezes email payload';
  v_second := public.claim_billing_alert_email('ea000000-0000-0000-0000-000000000001', v_payload);
  assert v_second is null, 'live claim blocks overlapping delivery';

  perform public.finish_billing_alert_email('ea000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000', 'wrong-worker', null);
  assert (select sent_at is null from public.billing_alerts where dedupe_key = 'email-test-alert'),
    'another worker cannot acknowledge this claim';

  perform public.finish_billing_alert_email('ea000000-0000-0000-0000-000000000001',
    (v_claim->>'token')::uuid, null, 'Resend HTTP 429');
  assert public.claim_billing_alert_email('ea000000-0000-0000-0000-000000000001', v_payload) is null,
    'failed delivery waits for retry time';
  update public.billing_alerts set email_next_attempt_at = now() - interval '1 second'
    where dedupe_key = 'email-test-alert';

  v_second := public.claim_billing_alert_email('ea000000-0000-0000-0000-000000000001',
    '{"from":"changed@example.com","to":["changed@example.com"],"subject":"Changed","text":"Changed"}');
  assert v_second->'payload' = v_payload, 'retry uses identical recipient and body for Resend idempotency';
  assert (select email_attempts = 2 from public.billing_alerts where dedupe_key = 'email-test-alert');

  perform public.finish_billing_alert_email('ea000000-0000-0000-0000-000000000001',
    (v_second->>'token')::uuid, 'accepted-email-id', null);
  assert (select sent_at is not null and email_provider_id = 'accepted-email-id'
          from public.billing_alerts where dedupe_key = 'email-test-alert');
  assert public.claim_billing_alert_email('ea000000-0000-0000-0000-000000000001', v_payload) is null,
    'accepted delivery cannot be claimed again';

  update public.billing_alerts set sent_at = null, email_first_attempt_at = now() - interval '23 hours 1 minute'
    where dedupe_key = 'email-test-alert';
  assert public.claim_billing_alert_email('ea000000-0000-0000-0000-000000000001', v_payload) is null,
    'uncertain delivery never retries after the provider dedupe window';

  update public.billing_alerts set email_first_attempt_at = null, email_next_attempt_at = null,
    created_at = now() - interval '1 minute' where dedupe_key = 'email-test-alert';
  insert into public.balance_transactions (client_id, amount, balance_after, type, note)
    values ('e0000000-0000-0000-0000-000000000001', 100, 110, 'topup', 'email test');
  assert public.claim_billing_alert_email('ea000000-0000-0000-0000-000000000001', v_payload) is null,
    'a newer top-up suppresses an obsolete low-balance email';
end;
$$;
rollback;
