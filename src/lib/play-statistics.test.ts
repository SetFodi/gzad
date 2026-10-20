import { describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { aggregateCampaignPlays } from './play-statistics'
import { readAllRows } from './supabase/read'

describe('campaign play statistics', () => {
  it('counts the actual distinct screens per Tbilisi day rather than assuming one taxi', () => {
    const days = aggregateCampaignPlays([
      { began_at: '2026-10-19T20:00:00Z', device_id: 'screen-a', duration_seconds: 10 },
      { began_at: '2026-10-20T09:00:00Z', device_id: 'screen-b', duration_seconds: 20 },
      { began_at: '2026-10-20T10:00:00Z', device_id: 'screen-a', duration_seconds: 10 },
    ])

    expect(days).toEqual([{
      date: '2026-10-20',
      play_count: 3,
      total_duration_seconds: 40,
      unique_taxis: 2,
      km_covered: null,
    }])
  })

  it('keeps genuine empty results empty and does not invent an unidentified taxi', () => {
    expect(aggregateCampaignPlays([])).toEqual([])
    expect(aggregateCampaignPlays([
      { began_at: '2026-10-20T19:59:00Z', device_id: null, duration_seconds: null },
      { began_at: '2026-10-20T20:00:00Z', device_id: 'screen-c', duration_seconds: 30 },
    ])).toEqual([
      { date: '2026-10-20', play_count: 1, total_duration_seconds: 0, unique_taxis: 0, km_covered: null },
      { date: '2026-10-21', play_count: 1, total_duration_seconds: 30, unique_taxis: 1, km_covered: null },
    ])
  })

  it('includes a screen first seen beyond the first Supabase result page', async () => {
    const records = Array.from({ length: 1001 }, (_, index) => ({
      began_at: '2026-10-20T09:00:00Z',
      duration_seconds: 10,
      device_id: index === 1000 ? 'screen-b' : 'screen-a',
    }))
    const requests: URL[] = []
    const supabase = createClient('http://local-test.invalid', 'local-test-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input) => {
          const url = new URL(String(input))
          requests.push(url)
          const from = Number(url.searchParams.get('offset') ?? 0)
          const limit = Number(url.searchParams.get('limit') ?? 1000)
          return new Response(JSON.stringify(records.slice(from, from + limit)), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        },
      },
    })
    const logs = await readAllRows((from, to) => supabase
      .from('play_logs')
      .select('began_at, duration_seconds, device_id')
      .eq('campaign_id', 'campaign-a')
      .order('began_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to))

    expect(aggregateCampaignPlays(logs)).toEqual([{
      date: '2026-10-20', play_count: 1001, total_duration_seconds: 10010, unique_taxis: 2, km_covered: null,
    }])
    expect(requests).toHaveLength(2)
    expect(requests.map(url => url.searchParams.get('campaign_id'))).toEqual(['eq.campaign-a', 'eq.campaign-a'])
  })

  it('rejects a failed later Supabase page instead of publishing partial campaign totals', async () => {
    const supabase = createClient('http://local-test.invalid', 'local-test-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input) => {
          const from = Number(new URL(String(input)).searchParams.get('offset') ?? 0)
          const failed = from > 0
          return new Response(JSON.stringify(failed
            ? { code: '42501', message: 'Play logs unavailable' }
            : Array.from({ length: 1000 }, () => ({
              began_at: '2026-10-20T09:00:00Z', device_id: 'screen-a', duration_seconds: 10,
            }))), {
            status: failed ? 403 : 200,
            headers: { 'Content-Type': 'application/json' },
          })
        },
      },
    })

    await expect(readAllRows((from, to) => supabase
      .from('play_logs')
      .select('began_at, duration_seconds, device_id')
      .eq('campaign_id', 'campaign-a')
      .order('began_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to))).rejects.toThrow('Play logs unavailable')
  })
})
