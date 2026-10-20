# Deployment

The Next.js application deploys through the repository's Vercel integration.
Database changes, email configuration, and the Realtime Server have separate
release steps. Never commit environment files, provider keys, database dumps,
or local Supabase CLI connection metadata.

## Initial application release

1. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
   Exercise the landing page, password sign-in, and protected route redirects.
2. Verify the target database has the baseline `010` tables, views, and RPCs.
   Use read-only schema queries. A migration-history entry alone does not
   establish that an older manually managed schema has every required feature.
3. Back up the database before applying additive forward migrations. The
   campaign-position and email-delivery migrations may be applied with their
   dependent delivery feature disabled. See the [migration reference](../migrations/README.md).
4. Keep `AUTH_DEVICE_VERIFICATION=off`, `BILLING_EMAIL_ENABLED` unset or `off`,
   `BILLING_METERED_FROM` unset, and `BILLING_RETENTION` unset or `off`.
   Custom SMTP and code templates are not yet configured for this release.
   Confirmed users retain normal password sign-in while verification is off.
5. Do not apply the auth trusted-session or client-cap migrations during this
   phase. The auth migration immediately rejects unapproved native sessions.
6. Deploy the application. Confirm the custom domain serves the intended
   release, anonymous users cannot access private panels, and existing
   confirmed users can sign in. Inspect deployment logs for configuration errors.

Deploying source does not enable metered charging, send balance emails,
delete retained data, or configure email delivery.

## Enable email-code verification

Prepare this as a coordinated release so users are not locked out between the
database and application changes.

1. Verify a company sending domain with the chosen mail provider. Resend can
   deliver Supabase Auth mail through custom SMTP. Keep its credentials server-only.
2. Configure Supabase custom SMTP and enable email confirmation. Set the
   confirmation and magic-link templates from `supabase/templates/`. Both use
   `{{ .Token }}` to show the code. Match native OTP expiry to the application's
   ten-minute challenge and check provider rate limits.
3. Check delivery to approved recipients before enabling the database gate.
   Prepare a recovery path for administrators who cannot receive a code.
4. Apply `20261020133430_auth_trusted_sessions.sql` and deploy the matching
   application with `AUTH_DEVICE_VERIFICATION=on` in the same release window.
   An optional `AUTH_DEVICE_SECRET` must contain at least 32 random characters.
   Without it, the server service-role key signs remembered-browser data.
5. Verify signup confirmation, the separate first sign-in code, normal repeat
   sign-in after logout, and challenges for a new browser or changed IP.
   Check invalid/expired codes and direct unapproved Supabase sessions are rejected.
6. After auth works, apply `20261020133824_client_daily_caps.sql`. Verify an
   approved client can change only their own campaign's daily cap.

Remembered-browser trust lasts 180 days. Clearing cookies, private browsing,
an IP change, or expiry requires another code. Rotating the signing secret
also invalidates remembered browsers and pending challenges.

Do not disable the application verification flag as a standalone rollback
after the database gate is applied. The database still requires approved
sessions. Coordinate any rollback of the gate and application together.

## Enable billing email

Apply `20261020133330_billing_alert_email_delivery.sql` first. Configure a
verified sender in `BILLING_EMAIL_FROM`, a server-only `RESEND_API_KEY`, and
the production `APP_URL`. Check a delivery to an approved recipient before
setting `BILLING_EMAIL_ENABLED=on`. Auth SMTP and application balance emails
use separate configuration, even when both use Resend.

Gmail SMTP can be used while a company sending domain is unavailable. Apply
`20261020170130_billing_alert_smtp_delivery.sql`, then set
`BILLING_EMAIL_PROVIDER=smtp`, `BILLING_SMTP_HOST=smtp.gmail.com`,
`BILLING_SMTP_PORT=465`, `BILLING_SMTP_USER`, and `BILLING_SMTP_PASS` to a Google
app password. Match `BILLING_EMAIL_FROM` to that Gmail account. Port 587 also
works with required STARTTLS. TLS certificate validation is always enabled.
Keep the password server-only. Returning to Resend requires its verified domain
and API key, then `BILLING_EMAIL_PROVIDER=resend`.

SMTP has no provider idempotency guarantee. Its claim is saved before sending.
Only definite failures before DATA are retried automatically. If acceptance is
unknown or saving acceptance fails, the attempt stays blocked for manual review
in `billing_alerts`, with `email_smtp_started_at` set and
`email_next_attempt_at=infinity`. Check the sending mailbox before resolving an
uncertain attempt. Never clear these fields just to retry an unconfirmed email.

Set a random server-only `CRON_SECRET` in Vercel to authenticate scheduled runs.
The Vercel schedule only calls `/api/billing/notifications`, which drains existing
alerts independently of billing. It can also receive an authenticated `POST` using `CRON_SECRET` or
the bridge's `CALLBACK_SECRET`; this path never calculates charges or changes
campaigns. The existing billing trigger continues delivering alerts after each
calculation. Verify the deployed bridge has `ENABLE_BILLING_TRIGGER=true` for
regular delivery and retries. The daily backup reads at most 50 alerts and stops
starting deliveries with ten seconds left in its 45-second worker budget. This
budget is best effort because SMTP timeouts apply per phase or idle connection,
rather than to the entire transaction. The route has a 60-second runtime limit.
Remaining alerts stay queued, and an interrupted SMTP attempt stays blocked for
manual review. The billing trigger still uses a batch of five for frequent delivery.
Billing calculation remains driven by the existing VPS trigger. Do not add a
calculation cron while configuring email delivery, since `CRON_SECRET` would also
authorize that route and enable scheduled charges.

## Enable metered billing and retention

Keep `BILLING_METERED_FROM` unset until all six screens report reliably and
at least seven days of dry-run comparisons have been reviewed. Dry-run requests
calculate differences without deducting balances. Choose a future Tbilisi
midnight for cutover and verify the deployment uses that timestamp.

Leave `BILLING_RETENTION` off until retention periods and accounting needs
are agreed. Enabling it can prune raw play/GPS data after rollup.

## Realtime Server

Application deployment does not update the VPS bridge. If a release changes
`realtime-server/`, deploy it separately using the configured host and process
manager, then verify controller reconnects, play/GPS callbacks, and the billing
trigger. Shared-secret rotations must be coordinated between the application
and bridge. Keep host addresses and credentials in deployment configuration.
