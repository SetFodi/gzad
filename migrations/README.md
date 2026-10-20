# Database migrations

Apply in numeric order in the Supabase SQL Editor
(Dashboard → SQL Editor → New query → paste → Run).

The numbered files contain the original schema baseline. Forward migrations
are in `supabase/migrations/`. Inspect the existing schema and take a backup
before applying a migration. Reapplication is covered by local SQL tests;
do not run every migration against a hosted project without checking its
release prerequisites.

| File | What it adds |
| --- | --- |
| `001_schema.sql` | clients, campaigns, ad_media, play_stats, invoices, base RLS, storage bucket |
| `002_callbacks.sql` | play_logs, gps_logs, devices |
| `003_groups.sql` | device_groups, `devices.group_id`, `campaigns.device_group_id` |
| `004_districts.sql` | `campaigns.districts` |
| `005_ad_duration.sql` | `ad_media.display_duration_seconds` |
| `006_billing.sql` | `clients.balance`, pricing_config, billing_logs |
| `007_audit_fixes.sql` | unique campaign names, play_stats upsert target |
| `008_fleet.sql` | `clients.role`, fleet_vehicles (previously applied ad hoc, never captured here) |
| `009_production_hardening.sql` | RLS status constraints, balance ledger, per-device keys, rate limiting, storage lockdown |
| `010_metered_billing.sql` | status history, daily caps, 10-minute billing rows, posting/usage functions, alerts outbox, read views, retention helpers. Requires 009 |

## Release prerequisites

Release preparation verified the baseline `010` database features through
read-only Supabase CLI queries. This verifies schema features, not the hosted
migration-history table. Recheck the target database before applying changes.

Follow [deployment instructions](../docs/deployment.md) for the phased rollout.
The campaign-position and email-delivery migrations are additive. The auth
and client-cap migrations must wait until SMTP, email confirmation, and code
templates are ready for the matching application release.

| Forward migration | Activation requirement |
| --- | --- |
| `20261020132954_billing_campaign_positions.sql` | Baseline 010; adds a service-only position reader and index |
| `20261020133330_billing_alert_email_delivery.sql` | Baseline 010; adds delivery leases, with sending disabled until `BILLING_EMAIL_ENABLED=on` |
| `20261020133430_auth_trusted_sessions.sql` | Configured SMTP and code templates, with coordinated `AUTH_DEVICE_VERIFICATION=on` deployment |
| `20261020133824_client_daily_caps.sql` | Auth migration already applied and verified |

## After applying 009

1. Re-provision the controllers so each picks up its own callback key: in the
   admin device page, run **Setup callbacks** for every device (or restart the
   realtime server — it reprovisions on each device connection).
2. Watch the logs for `Provisioned with shared secret`. Once that line stops
   appearing, set `STRICT_DEVICE_KEYS=true` in the Vercel environment to reject
   the shared secret in callback URLs entirely.

## Metered billing (010)

The billing route calls functions introduced in `010`. Deploying it before
those functions exist makes billing requests fail. With `BILLING_METERED_FROM`
unset, billing uses whole slot-hours and the configured prices, with status
history, late uploads, atomic posting, daily caps, and an alerts outbox.

1. Verify the baseline schema and apply only missing prerequisites after backup.
2. Deploy the application with metered billing and retention disabled.
3. Compare for at least seven days with all six screens reporting. The dry run
   reads data without posting charges:
   `GET /api/billing/calculate?dryRun=1&from=<ISO>&to=<ISO>` with the billing
   secret (at most two days per call).
4. Switch to 10-minute blocks by setting `BILLING_METERED_FROM` to a future
   Tbilisi midnight, which is 20:00 UTC the day before, and redeploying. Unset
   it to return to hourly mode; the overlap guard prevents double charges.

`BILLING_RETENTION=on` enables the daily rollup of old billing rows and pruning
of raw play/GPS logs (periods in `pricing_config.billing_settings`). It deletes
data, so it is off unless set.

**Testing locally.** `tests/run-local.sh` applies migrations to a throwaway
Postgres 15+ database with stand-ins for Supabase's auth and storage. It runs
the billing, position, email, auth, and daily-cap SQL scenarios. The pipeline
test runs against the same local database:

```bash
PGHOST=localhost PGPORT=54329 PGUSER=postgres migrations/tests/run-local.sh
BILLING_PG_URL=postgres://postgres@localhost:54329/gzad_test npx vitest run src/lib/metering.e2e.test.ts
```

Never point either at Supabase.
