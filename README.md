# Gzad

Mobile digital advertising on Tbilisi's taxi fleet. Advertisers buy airtime on
LED screens mounted on partner vehicles; the screens report what they played and
where, and clients are billed hourly from a prepaid balance.

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
- **`realtime-server/`** — Express + WebSocket bridge to the controllers.
- **`migrations/`** — ordered SQL, applied by hand in the Supabase SQL editor.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev
```

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

`/api/billing/calculate` charges every whole hour that isn't in `billing_logs`
yet, so a missed run is picked up by the next one instead of losing the revenue.
It is safe to call repeatedly — a unique index on
`(campaign_id, device_id, period_start)` means only newly inserted rows are
deducted from a balance.

Two things trigger it:

| Trigger | Cadence | Configured in |
| --- | --- | --- |
| Vercel cron | daily (free plan limit) | `vercel.json` |
| Realtime Server | every 15 min | `ENABLE_BILLING_TRIGGER=true` on the VPS |

The VPS trigger is what actually gives hourly billing; the Vercel cron is a
safety net for when the VPS is down. If you move to a paid Vercel plan, change
the cron to `0 * * * *` and the VPS trigger becomes redundant.

When a balance hits zero the client's campaigns move to `paused_billing` and
their devices are re-synced so the ads stop. Topping up through
**Admin → Pricing → Client Balances** reactivates them and pushes the playlists
again.

## Deploying

**App** — push to `master`; Vercel builds and deploys.

**Realtime Server** — there is no pipeline; copy and restart:

```bash
scp realtime-server/server.js root@167.71.50.3:/opt/gzad-realtime/server.js
ssh root@167.71.50.3 'pm2 restart gzad-realtime'
```

**Database** — see [migrations/README.md](migrations/README.md). Migrations are
applied by hand and are idempotent. `008` and `009` are not yet applied to
production.

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

**Billing looks wrong.** `billing_logs` is the audit trail — one row per
slot-hour with the rate and multipliers that produced it. `balance_transactions`
records every movement of credit and who made it.

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
