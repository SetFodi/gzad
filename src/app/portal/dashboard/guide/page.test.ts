import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  user: { id: 'test-client' } as { id: string } | null,
  client: { role: 'client', is_admin: false } as { role: string; is_admin: boolean } | null,
  pricingRead: vi.fn(),
  rows: [
    { key: 'base_rates', value: { '10': 2, '20': 3.4, '30': 4.6 } },
    { key: 'district_tiers', value: { Vake: 1 } },
    { key: 'district_multipliers', value: { '1': 1.45, '2': 1.25, '3': 1.1, '4': 1 } },
    { key: 'time_multipliers', value: { '6': .75 } },
  ] as { key: string; value: unknown }[],
  error: null as null | { message: string },
}))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))
vi.mock('@/components/education/ClientGuide', () => ({ default: () => null }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.user } }) },
  from: (table: string) => ({ select: () => table === 'clients'
    ? { eq: () => ({ single: async () => ({ data: state.client }) }) }
    : { in: async () => { state.pricingRead(); return { data: state.rows, error: state.error } } },
  }),
}) }))
import GuidePage from './page'

const validRows = state.rows
beforeEach(() => {
  vi.stubGlobal('React', React)
  state.user = { id: 'test-client' }
  state.client = { role: 'client', is_admin: false }
  state.error = null
  state.rows = validRows
  state.pricingRead.mockClear()
})
const page = () => GuidePage({ searchParams: Promise.resolve({ welcome: '1' }) })

describe('client guide access', () => {
  it('redirects unauthenticated visitors before reading pricing', async () => {
    state.user = null
    await expect(page()).rejects.toThrow('redirect:/portal/login')
    expect(state.pricingRead).not.toHaveBeenCalled()
  })
  it.each([
    [{ role: 'admin', is_admin: false }, '/admin'],
    [{ role: 'client', is_admin: true }, '/admin'],
    [{ role: 'fleet', is_admin: false }, '/fleet'],
    [null, '/portal/login'],
  ])('does not expose client calculators to another role', async (client, destination) => {
    state.client = client
    await expect(page()).rejects.toThrow(`redirect:${destination}`)
    expect(state.pricingRead).not.toHaveBeenCalled()
  })
  it('passes the current configured rates and welcome state to the client tools', async () => {
    const rendered = await page()
    expect(rendered.props.welcome).toBe(true)
    expect(rendered.props.config.baseRates['20']).toBe(3.4)
    expect(rendered.props.config.timeMultipliers['6']).toBe(.75)
    expect(state.pricingRead).toHaveBeenCalledOnce()
  })
  it('shows an unavailable state instead of made-up rates on a failed read', async () => {
    state.error = { message: 'Pricing read failed' }
    expect((await page()).props.config).toBeNull()
  })
  it.each([
    { key: 'base_rates', value: {} },
    { key: 'base_rates', value: { '10': -2, '20': 3.4, '30': 4.6 } },
    { key: 'time_multipliers', value: { '25': 1.3 } },
    { key: 'district_tiers', value: { Vake: 5 } },
  ])('does not show calculations for invalid configured pricing: $key', async row => {
    state.rows = validRows.map(item => item.key === row.key ? row : item)
    expect((await page()).props.config).toBeNull()
  })
})
