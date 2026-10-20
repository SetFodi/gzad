// End-to-end check of the metering pipeline against a real Postgres with the
// migrations applied (migrations/tests/run-local.sh). It runs the same steps as
// the billing route — usage and positions RPCs, priceBlocks, post_billing_blocks
// — through psql instead of PostgREST. Opt-in:
//
//   BILLING_PG_URL=postgres://postgres@localhost:54329/gzad_test npx vitest run src/lib/metering.e2e.test.ts
//
// Never point it at Supabase: it writes and deletes rows.

import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { parsePricingConfig } from './billing'
import { groupByClient, priceBlocks, type PositionRow, type UsageRow } from './metering'

const url = process.env.BILLING_PG_URL
const SERVICE = `set request.jwt.claims = '{"role":"service_role"}';`

function sql(query: string): string {
  return execFileSync('psql', [url!, '-tAqX', '-v', 'ON_ERROR_STOP=1', '-c', `${SERVICE} ${query}`], {
    encoding: 'utf8',
  }).trim()
}
const json = <T>(query: string): T => JSON.parse(sql(`select coalesce(json_agg(t), '[]') from (${query}) t`))

const CLIENT = 'e2e00000-0000-0000-0000-000000000001'
const A = 'e2ea0000-0000-0000-0000-000000000001'
const B = 'e2eb0000-0000-0000-0000-000000000001'

describe.skipIf(!url)('metering pipeline against Postgres', () => {
  it('meters, posts, stays idempotent and bills late plays once', () => {
    sql(`
      delete from public.billing_logs where client_id = '${CLIENT}';
      delete from public.balance_transactions where client_id = '${CLIENT}';
      delete from public.billing_carry where client_id = '${CLIENT}';
      delete from public.play_logs where device_id = 'e2e-dev';
      delete from public.campaigns where client_id = '${CLIENT}';
      delete from public.clients where id = '${CLIENT}';
      insert into public.clients (id, email, company_name, contact_name, balance)
        values ('${CLIENT}', 'e2e@test', 'E2E', 'E2E', 100);
      insert into public.devices (id, name) values ('e2e-dev', 'E2E taxi') on conflict (id) do nothing;
      insert into public.campaigns (id, client_id, name, status, slot_duration) values
        ('${A}', '${CLIENT}', 'E2E Ten', 'active', 10),
        ('${B}', '${CLIENT}', 'E2E Twenty', 'active', 20);
      update public.campaign_status_history set changed_at = '2026-10-01T00:00Z'
        where campaign_id in ('${A}', '${B}');
      insert into public.play_logs (device_id, campaign_id, program_name, began_at, duration_seconds, lat, lng, received_at)
      values ('e2e-dev', '${B}', 'E2E Twenty', '2026-10-15T07:30Z', 20, 41.73, 44.75, '2026-10-15T07:31Z');
      insert into public.play_logs (device_id, campaign_id, program_name, began_at, duration_seconds, lat, lng, received_at)
      select 'e2e-dev', '${A}', 'E2E Ten', timestamptz '2026-10-15T08:00:00Z' + make_interval(secs => g * 29), 10,
             case when g < 15 then 41.73 else 41.80 end, 44.75, timestamptz '2026-10-15T08:11:00Z'
      from generate_series(0, 19) g;
      insert into public.play_logs (device_id, campaign_id, program_name, began_at, duration_seconds, received_at)
      select 'e2e-dev', '${B}', 'E2E Twenty', timestamptz '2026-10-15T08:00:10Z' + make_interval(secs => g * 30), 20,
             timestamptz '2026-10-15T08:11:00Z'
      from generate_series(0, 9) g;
    `)

    const config = parsePricingConfig([
      { key: 'district_tiers', value: { 'Admin Vake': 1, Saburtalo: 2 } },
      { key: 'district_polygons', value: {
        'Admin Vake': { color: '#123456', polygon: [[41.7, 44.7], [41.76, 44.7], [41.76, 44.8], [41.7, 44.8]] },
        Saburtalo: { color: '#654321', polygon: [[41.76, 44.7], [41.85, 44.7], [41.85, 44.8], [41.76, 44.8]] },
      } },
      { key: 'time_multipliers', value: { '12': 1.3 } },
    ])
    const campaigns = new Map([
      [A, { client_id: CLIENT, slot_duration: 10 }],
      [B, { client_id: CLIENT, slot_duration: 20 }],
    ])
    const window = { mode: 'metered' as const, blockMinutes: 10, from: new Date('2026-10-15T08:00:00Z') }
    const args = (receivedSince: string | null) =>
      `'2026-10-15T08:00Z', '2026-10-15T08:10Z', ${receivedSince ? `'${receivedSince}'` : 'null'}, '2026-10-08T00:00Z', 10`

    const price = (receivedSince: string | null) => {
      const usage = json<UsageRow[]>(`select * from public.billing_block_usage(${args(receivedSince)}) where device_id = 'e2e-dev'`)
      const positions = json<PositionRow[]>(`select * from public.billing_campaign_positions(${args(receivedSince)}) where device_id = 'e2e-dev'`)
      return groupByClient(priceBlocks(window, usage, positions, config, campaigns).charges, campaigns).get(CLIENT) ?? []
    }
    const post = (rows: unknown) =>
      JSON.parse(sql(`select public.post_billing_blocks('${CLIENT}', '${JSON.stringify(rows)}'::jsonb, 'e2e')`))
    const balance = () => Number(sql(`select balance from public.clients where id = '${CLIENT}'`))

    // A uses its plays' majority. B's missing GPS uses its last own playback.
    // Both resolve to the saved Admin map, rather than the built-in name.
    const first = price(null)
    expect(first.map((c) => [c.campaign_id, c.proration, c.district])).toEqual(
      expect.arrayContaining([
        [A, 1, 'Admin Vake'],
        [B, 0.5, 'Admin Vake'],
      ]),
    )
    const posted = post(first)
    expect(Number(posted.charged)).toBe(1.16) // 0.628333 + 0.534083
    expect(balance()).toBe(98.84)

    // Same airtime again: nothing new, nothing charged.
    expect(Number(post(price(null)).charged)).toBe(0)
    expect(balance()).toBe(98.84)

    // B's other 10 plays upload late: the block is found by received_at and
    // raised to a full block; only the difference is charged.
    sql(`
      insert into public.play_logs (device_id, campaign_id, program_name, began_at, duration_seconds, received_at)
      select 'e2e-dev', '${B}', 'E2E Twenty', timestamptz '2026-10-15T08:00:25Z' + make_interval(secs => g * 30), 20,
             timestamptz '2026-10-15T09:30:00Z'
      from generate_series(0, 9) g;
    `)
    const late = price('2026-10-15T09:00:00Z')
    expect(late.find((c) => c.campaign_id === B)?.proration).toBe(1)
    const raised = post(late)
    expect(Number(raised.rows)).toBe(1)
    expect(Number(raised.charged)).toBe(0.54)
    expect(balance()).toBe(98.3)

    // The ledger matches the rows to within half a tetri.
    const rowsTotal = Number(sql(`select sum(total_cost) from public.billing_logs where client_id = '${CLIENT}'`))
    const ledger = -Number(sql(`select sum(amount) from public.balance_transactions where client_id = '${CLIENT}'`))
    const carry = Number(sql(`select carry from public.billing_carry where client_id = '${CLIENT}'`))
    expect(Math.abs(rowsTotal - (ledger + carry))).toBeLessThan(0.000001)
  })
})
