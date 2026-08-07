# Database migrations

Apply in numeric order in the Supabase SQL Editor
(Dashboard → SQL Editor → New query → paste → Run).

There is no migration runner: this project uses hosted Supabase and the files
are applied by hand. Every file is written to be **idempotent**, so re-running
one is safe and a partially-migrated database can be brought forward by simply
running everything in order.

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

## Outstanding

`008` and `009` have **not** been applied to production yet. Until they are:

- clients can still insert `approved` media and `active` campaigns directly
  through PostgREST;
- balance top-ups fall back to read-modify-write (the app detects the missing
  function and logs a warning);
- signup rate limiting fails open;
- devices keep authenticating callbacks with the shared secret.

The application code handles all of these gracefully, so the deploy order does
not matter — but the gaps stay open until the SQL is run.

## After applying 009

1. Re-provision the controllers so each picks up its own callback key: in the
   admin device page, run **Setup callbacks** for every device (or restart the
   realtime server — it reprovisions on each device connection).
2. Watch the logs for `Provisioned with shared secret`. Once that line stops
   appearing, set `STRICT_DEVICE_KEYS=true` in the Vercel environment to reject
   the shared secret in callback URLs entirely.
