-- Requires migrations/010_metered_billing.sql. No messages are sent by this
-- migration. Delivery also requires BILLING_EMAIL_ENABLED=on in the app.
alter table public.billing_alerts
  add column if not exists email_payload jsonb,
  add column if not exists email_first_attempt_at timestamptz,
  add column if not exists email_next_attempt_at timestamptz,
  add column if not exists email_claim_token uuid,
  add column if not exists email_claim_until timestamptz,
  add column if not exists email_attempts integer not null default 0,
  add column if not exists email_provider_id text,
  add column if not exists email_last_error text;

create index if not exists idx_billing_alerts_email_pending
  on public.billing_alerts (created_at, id)
  where sent_at is null and dismissed_at is null
    and kind in ('low_20pct', 'runway_1d', 'depleted');

-- Invoker rights: only the service role can call these and it already has RLS
-- bypass. A row lock and short lease prevent overlapping billing runs from
-- issuing independent requests. Store the first payload, including recipient,
-- because Resend rejects a changed payload under the same idempotency key.
create or replace function public.claim_billing_alert_email(p_alert_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_alert public.billing_alerts%rowtype;
  v_token uuid := gen_random_uuid();
begin
  select * into v_alert from public.billing_alerts where id = p_alert_id for update;
  if not found or v_alert.sent_at is not null or v_alert.dismissed_at is not null
    or v_alert.kind not in ('low_20pct', 'runway_1d', 'depleted')
    or v_alert.created_at < now() - interval '24 hours'
    or v_alert.email_claim_until > now()
    or v_alert.email_next_attempt_at > now() then
    return null;
  end if;

  -- A new top-up resolves warnings from the preceding balance cycle. Keep the
  -- portal record, but do not send an obsolete low-balance message afterwards.
  if exists (
    select 1 from public.balance_transactions
    where client_id = v_alert.client_id and type = 'topup' and created_at > v_alert.created_at
  ) then
    update public.billing_alerts set
      email_last_error = 'Superseded by a newer top-up',
      email_next_attempt_at = 'infinity'::timestamptz
    where id = p_alert_id;
    return null;
  end if;

  -- Resend keeps idempotency keys for 24 hours. After an uncertain acceptance,
  -- never retry beyond 23 hours and risk sending a duplicate. Inspect the
  -- provider log manually if delivery remains unresolved.
  if v_alert.email_first_attempt_at <= now() - interval '23 hours' then
    update public.billing_alerts set
      email_last_error = 'Retry window ended; check Resend before sending again',
      email_next_attempt_at = 'infinity'::timestamptz,
      email_claim_token = null,
      email_claim_until = null
    where id = p_alert_id;
    return null;
  end if;

  if v_alert.email_payload is null and (
    jsonb_typeof(p_payload) <> 'object'
    or nullif(p_payload->>'from', '') is null
    or jsonb_typeof(p_payload->'to') <> 'array'
    or jsonb_array_length(p_payload->'to') <> 1
    or nullif(p_payload->>'subject', '') is null
    or nullif(p_payload->>'text', '') is null
  ) then
    raise exception 'Invalid billing email payload';
  end if;

  update public.billing_alerts set
    email_payload = coalesce(email_payload, p_payload),
    email_first_attempt_at = coalesce(email_first_attempt_at, now()),
    email_claim_token = v_token,
    email_claim_until = now() + interval '1 minute',
    email_attempts = email_attempts + 1
  where id = p_alert_id
  returning * into v_alert;
  return jsonb_build_object('token', v_token, 'payload', v_alert.email_payload);
end;
$$;

create or replace function public.finish_billing_alert_email(
  p_alert_id uuid, p_claim_token uuid, p_provider_id text, p_error text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.billing_alerts set
    sent_at = case when p_provider_id is not null then now() else sent_at end,
    email_provider_id = p_provider_id,
    email_last_error = left(p_error, 500),
    email_next_attempt_at = case when p_provider_id is null then now() + interval '15 minutes' else null end,
    email_claim_token = null,
    email_claim_until = null
  where id = p_alert_id and email_claim_token = p_claim_token and sent_at is null;
$$;

revoke all on function public.claim_billing_alert_email(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.finish_billing_alert_email(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_billing_alert_email(uuid, jsonb) to service_role;
grant execute on function public.finish_billing_alert_email(uuid, uuid, text, text) to service_role;
