-- Requires the billing_alert_email_delivery migration. SMTP has no provider
-- idempotency guarantee, so durably stop retries before sending anything.
alter table public.billing_alerts
  add column if not exists email_transport text check (email_transport in ('smtp', 'resend')),
  add column if not exists email_smtp_started_at timestamptz;

create or replace function public.claim_billing_alert_smtp(p_alert_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_alert public.billing_alerts%rowtype;
  v_claim jsonb;
begin
  select * into v_alert from public.billing_alerts where id = p_alert_id for update;
  if not found or v_alert.sent_at is not null or v_alert.dismissed_at is not null
    or v_alert.email_smtp_started_at is not null then
    return null;
  end if;

  -- Do not switch a previously attempted Resend delivery to SMTP. Resend may
  -- already have accepted it even if its acknowledgement was lost.
  if v_alert.email_first_attempt_at is not null and v_alert.email_transport is distinct from 'smtp' then
    update public.billing_alerts set
      email_next_attempt_at = 'infinity'::timestamptz,
      email_last_error = 'Provider changed after a delivery attempt; manual review required'
    where id = p_alert_id;
    return null;
  end if;

  v_claim := public.claim_billing_alert_email(p_alert_id, p_payload);
  if v_claim is null then return null; end if;

  update public.billing_alerts set
    email_transport = 'smtp',
    email_smtp_started_at = now(),
    email_next_attempt_at = 'infinity'::timestamptz,
    email_last_error = 'SMTP delivery started; acceptance is unconfirmed'
  where id = p_alert_id;
  return v_claim;
end;
$$;

create or replace function public.finish_billing_alert_smtp(
  p_alert_id uuid, p_claim_token uuid, p_provider_id text, p_error text, p_retry_safe boolean
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
    email_next_attempt_at = case
      when p_provider_id is not null then null
      when p_retry_safe is true then now() + interval '15 minutes'
      else 'infinity'::timestamptz end,
    email_smtp_started_at = case when p_provider_id is null and p_retry_safe is true then null else email_smtp_started_at end,
    email_claim_token = null,
    email_claim_until = null
  where id = p_alert_id and email_claim_token = p_claim_token
    and email_transport = 'smtp' and email_smtp_started_at is not null and sent_at is null;
$$;

revoke all on function public.claim_billing_alert_smtp(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.finish_billing_alert_smtp(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_billing_alert_smtp(uuid, jsonb) to service_role;
grant execute on function public.finish_billing_alert_smtp(uuid, uuid, text, text, boolean) to service_role;
