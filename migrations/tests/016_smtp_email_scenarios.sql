-- Local Postgres only. No provider connections. All test rows roll back.
begin;
set local request.jwt.claims = '{"role":"service_role"}';

insert into public.clients (id, email, company_name, contact_name, balance)
values ('e0160000-0000-0000-0000-000000000001', 'smtp-test@example.invalid', 'SMTP test', 'SMTP test', 10);
insert into public.billing_alerts (client_id, kind, balance, detail, dedupe_key)
select 'e0160000-0000-0000-0000-000000000001', 'low_20pct', 10, '{"pct":20}'::jsonb, 'smtp-test-' || label
from unnest(array['accepted', 'uncertain', 'ack-failure', 'rejected', 'provider-change']) label;

do $$
declare
  v_id uuid;
  v_claim jsonb;
  v_payload jsonb := '{"from":"billing@example.invalid","to":["client@example.invalid"],"subject":"Low balance","text":"Balance 10"}';
begin
  assert not has_function_privilege('anon', 'public.claim_billing_alert_smtp(uuid,jsonb)', 'execute');
  assert not has_function_privilege('authenticated', 'public.finish_billing_alert_smtp(uuid,uuid,text,text,boolean)', 'execute');
  assert has_function_privilege('service_role', 'public.claim_billing_alert_smtp(uuid,jsonb)', 'execute');

  select id into v_id from public.billing_alerts where dedupe_key = 'smtp-test-accepted';
  v_claim := public.claim_billing_alert_smtp(v_id, v_payload);
  assert v_claim->'payload' = v_payload;
  assert (select email_smtp_started_at is not null and email_next_attempt_at = 'infinity'::timestamptz
    from public.billing_alerts where id = v_id), 'SMTP blocks retries before any network send';
  assert public.claim_billing_alert_smtp(v_id, v_payload) is null, 'overlapping SMTP worker cannot claim';
  perform public.finish_billing_alert_smtp(v_id, (v_claim->>'token')::uuid, 'smtp-message-id', null, false);
  assert (select sent_at is not null and email_provider_id = 'smtp-message-id'
    from public.billing_alerts where id = v_id), 'accepted SMTP delivery is recorded';
  assert public.claim_billing_alert_smtp(v_id, v_payload) is null, 'accepted delivery cannot repeat';

  select id into v_id from public.billing_alerts where dedupe_key = 'smtp-test-uncertain';
  v_claim := public.claim_billing_alert_smtp(v_id, v_payload);
  perform public.finish_billing_alert_smtp(v_id, (v_claim->>'token')::uuid, null, 'SMTP acceptance unknown', false);
  assert (select sent_at is null and email_smtp_started_at is not null and email_next_attempt_at = 'infinity'::timestamptz
    from public.billing_alerts where id = v_id), 'unknown acceptance stays blocked for manual review';
  assert public.claim_billing_alert_smtp(v_id, v_payload) is null;
  assert public.claim_billing_alert_email(v_id, v_payload) is null, 'switching to Resend cannot resend an uncertain SMTP attempt';

  select id into v_id from public.billing_alerts where dedupe_key = 'smtp-test-ack-failure';
  v_claim := public.claim_billing_alert_smtp(v_id, v_payload);
  begin
    -- The provider accepted, but the transaction saving that fact fails.
    perform public.finish_billing_alert_smtp(v_id, (v_claim->>'token')::uuid, 'smtp-accepted-but-unsaved', null, false);
    raise exception 'simulate acknowledgement transaction failure';
  exception when raise_exception then null;
  end;
  update public.billing_alerts set email_claim_until = now() - interval '1 minute' where id = v_id;
  assert (select sent_at is null and email_smtp_started_at is not null from public.billing_alerts where id = v_id);
  assert public.claim_billing_alert_smtp(v_id, v_payload) is null, 'lost DB acknowledgement never causes another SMTP send';
  assert public.claim_billing_alert_email(v_id, v_payload) is null, 'expired lease does not reopen the uncertain attempt';
  perform public.finish_billing_alert_smtp(v_id, gen_random_uuid(), 'wrong-worker', null, false);
  assert (select sent_at is null from public.billing_alerts where id = v_id), 'another worker cannot acknowledge the claim';

  select id into v_id from public.billing_alerts where dedupe_key = 'smtp-test-rejected';
  v_claim := public.claim_billing_alert_smtp(v_id, v_payload);
  perform public.finish_billing_alert_smtp(v_id, (v_claim->>'token')::uuid, null, 'SMTP RCPT rejected', true);
  assert (select sent_at is null and email_smtp_started_at is null and email_next_attempt_at = now() + interval '15 minutes'
    from public.billing_alerts where id = v_id), 'definite pre-DATA failure can retry after backoff';
  assert public.claim_billing_alert_smtp(v_id, v_payload) is null, 'backoff is respected';
  update public.billing_alerts set email_next_attempt_at = now() - interval '1 second' where id = v_id;
  v_claim := public.claim_billing_alert_smtp(v_id, '{"from":"changed@example.invalid","to":["changed@example.invalid"],"subject":"Changed","text":"Changed"}');
  assert v_claim->'payload' = v_payload, 'retry retains the frozen recipient and contents';
  assert (select email_attempts = 2 from public.billing_alerts where id = v_id);

  select id into v_id from public.billing_alerts where dedupe_key = 'smtp-test-provider-change';
  v_claim := public.claim_billing_alert_email(v_id, v_payload);
  update public.billing_alerts set email_claim_until = now() - interval '1 minute' where id = v_id;
  assert public.claim_billing_alert_smtp(v_id, v_payload) is null, 'SMTP must not repeat an uncertain prior Resend delivery';

  assert (select balance = 10 from public.clients where id = 'e0160000-0000-0000-0000-000000000001');
  assert not exists (select 1 from public.balance_transactions where client_id = 'e0160000-0000-0000-0000-000000000001');
  assert not exists (select 1 from public.billing_logs where client_id = 'e0160000-0000-0000-0000-000000000001');
end;
$$;
rollback;
