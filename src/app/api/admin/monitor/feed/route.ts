import { NextRequest, NextResponse } from 'next/server'
import { CARD_ID, isAdmin, serviceClient } from '@/lib/live-view-server'
import { MAX_TILES, type PlayReport } from '@/lib/live-view'

// Enough history to measure each item's real timing across a couple of loops,
// and to anchor on the newest play.
const REPORTS_PER_SCREEN = 40

// GET /api/admin/monitor/feed?devices=a,b,c — the newest play reports for every
// screen on the wall, in one request. serverTime lets the browser correct its clock.
export async function GET(request: NextRequest) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const ids = [...new Set(
    (request.nextUrl.searchParams.get('devices') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((id) => CARD_ID.test(id)),
  )].slice(0, MAX_TILES)

  const db = serviceClient()
  const results = await Promise.all(ids.map((id) =>
    db.from('play_logs')
      .select('program_id, program_name, began_at, duration_seconds')
      .eq('device_id', id)
      .order('began_at', { ascending: false })
      .limit(REPORTS_PER_SCREEN),
  ))

  const reports: Record<string, PlayReport[]> = {}
  ids.forEach((id, i) => {
    reports[id] = (results[i].data ?? [])
      .map((r) => ({
        pid: (r.program_id as string | null) ?? null,
        name: (r.program_name as string | null) ?? '',
        beganAt: Date.parse(r.began_at as string),
        duration: Number(r.duration_seconds) || 0,
      }))
      .filter((r) => Number.isFinite(r.beganAt))
  })

  return NextResponse.json({ serverTime: Date.now(), reports })
}
