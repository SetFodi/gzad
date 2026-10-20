# Gzad

Mobile digital advertising on Tbilisi's taxi fleet. Advertisers buy airtime on
LED screens mounted on partner vehicles; the screens report what they played and
where, and clients are billed hourly from a prepaid balance.

The application includes the landing page, advertiser portal, fleet portal,
admin tools, authentication, and billing. See [deployment instructions](docs/deployment.md)
for database prerequisites and features that require separate activation.

## Architecture

```
Advertiser / Fleet owner / Admin
            │
       Next.js app  ──────────────  Supabase (Postgres + Auth + Storage)
      (Vercel)                        · RLS separates clients, fleets, admins
            │                         · ad media lives in the ad-media bucket
            │ HTTP (REALTIME_SERVER_SECRET)
            ▼
    Realtime Server  ── WebSocket ──  Xixun Y12 controllers (in vehicles)
    (VPS, pm2)                          · receive programs to play
            ▲                           · post play logs + GPS back
            └──── play logs / GPS ───────┘  (per-device callback key)
```

- **`src/app`** — landing page, client portal, fleet portal, admin, API routes.
- **`src/lib/slots.ts`** — the inventory model. A device runs 5 slots; one live
  campaign occupies one slot no matter how many creatives it uploaded. Both the
  admin slot view and the playlist pushed to hardware come from here, so they
  cannot disagree.
- **`src/lib/device-sync.ts`** — turns slots into a program and pushes it.
- **`src/lib/billing.ts`** — pure pricing maths (unit tested).
- **`src/lib/metering.ts`** — billing candidate calculation and atomic posting.
- **`realtime-server/`** — Express + WebSocket bridge to the controllers.
- **`migrations/`** — ordered SQL, applied by hand in the Supabase SQL editor.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev
```

Open `/` for the landing, `/portal/login` to sign in, `/portal/dashboard` for
advertisers, `/admin` for staff, and `/fleet` for fleet partners. Local
development uses the backend configured in `.env.local`.

The Realtime Server is optional locally; without it, device pages show a
"cannot reach Realtime Server" notice and everything else works.

```bash
cd realtime-server && npm install && npm start
```

## Checks

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

CI runs the same four on every push and pull request.

## How billing works

Airtime is priced per **slot-hour**: one campaign playing on one device for one
hour, charged once no matter how many times it looped.

```
cost = base_rate(slot_duration) × district_multiplier(tier) × time_multiplier(hour)
```

`/api/billing/calculate` uses campaign status history and reported plays to
calculate missing billing periods, then posts new charges atomically. Repeated
runs and late plays are covered by the SQL scenarios and pipeline test.
Whole-hour billing remains the default. A future `BILLING_METERED_FROM` value
switches later periods to ten-minute blocks, with overlap protection against
previous charges. Daily caps, a balance ledger, and usage views are included.

The billing route requires migration `010` even in hourly mode. Retention only
runs when `BILLING_RETENTION=on`. Deploying the application does not apply
migrations or activate metered billing, retention, or email notifications.

The Realtime Server drives billing when its trigger is enabled:

| Trigger | Cadence | Configured in |
| --- | --- | --- |
| Realtime Server | every 15 min | `ENABLE_BILLING_TRIGGER=true` on the VPS |

Vercel's daily cron only drains existing billing email alerts through
`/api/billing/notifications`. It never calculates charges. Configure a server-only
`CRON_SECRET` to authenticate that schedule. Keep billing scheduling separate
from email setup so enabling delivery does not activate charges.

When a balance hits zero the client's campaigns move to `paused_billing` and
their devices are re-synced so the ads stop. Topping up through
**Admin → Pricing → Client Balances** reactivates them and pushes the playlists
again.

## Deploying

Follow the [deployment instructions](docs/deployment.md) before pushing to
`master`, which is connected to Vercel. Database migrations and the Realtime
Server are deployed separately. The [migration reference](migrations/README.md)
lists database files and local SQL checks.

The initial release keeps email verification, billing email, metered billing,
and retention disabled. Confirmed accounts retain password sign-in. SMTP,
code templates, and the authentication database gate must be prepared together
before conditional email-code verification is enabled.

## Operations

**A device is playing the wrong thing.** Devices keep playing the last program
they were sent. Approving media, changing a campaign's status, or editing a
duration now re-pushes automatically; to force it, use **Push to Group** on the
campaign page, or `POST /api/admin/sync` with `{ groupId }`, `{ campaignId }` or
`{ clientId }`.

**A campaign is live but not on screen.** Check, in order: it has a device
group, its status is `active`, today is inside its start/end dates, it has
approved media, and it isn't sixth in line — only 5 slots exist per device. The
admin **Slots** page shows all of this per device.

**Billing looks wrong.** `billing_logs` contains period charges and pricing
details. `balance_transactions` records credit movements. Migration `010` adds
usage summaries, daily caps, and a dry-run path for comparing calculations
before posting. See the migration README for the exact rollout order.

**Rotating secrets.** `CALLBACK_SECRET` and `REALTIME_SERVER_SECRET` must be
changed in both Vercel and the VPS `.env` together, then `pm2 restart
gzad-realtime`. Device callback keys live in `devices.api_key`; delete one and
re-run **Setup callbacks** for that device to issue a fresh key.

## Not yet done

- No payment integration — balances are credited by an admin by hand.
- The Realtime Server is a single in-memory instance and a single point of
  failure; a restart drops in-flight commands (devices reconnect on their own).
- No error monitoring or alerting. If billing stops running, nothing pages you.
- Supabase backups (PITR) are a dashboard setting and are not configured here.
