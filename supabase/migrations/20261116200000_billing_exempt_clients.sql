-- Internal and test accounts (staff, the LED test account) play ads without
-- being charged. Billing still records their plays, at ₾0, so their balance
-- never moves and their campaigns are never paused for running out.
-- Clients can't update their own row (no UPDATE policy outside admins), so
-- only admins and the service role can set this.

alter table public.clients
  add column if not exists billing_exempt boolean not null default false;

comment on column public.clients.billing_exempt is
  'Internal or test account: billing records plays at 0 and never pauses its campaigns for balance.';
