import { NextRequest, NextResponse } from 'next/server'
import { CARD_ID, isAdmin, serviceClient, watchScreens, type RealtimeDevice } from '@/lib/live-view-server'
import { MAX_TILES, type Connection, type NowPlaying, type PlayReport } from '@/lib/live-view'

// Enough history to measure each item's real timing across a couple of loops,
// to see the last few upload batches, and to anchor on the newest play.
const REPORTS_PER_SCREEN = 60
// The wall polls this every few seconds; a slow Realtime Server mustn't hold the reports up.
const STATUS_TIMEOUT_MS = 4000

const time = (iso: string | null | undefined): number | null => {
  const ms = iso ? Date.parse(iso) : NaN
  return Number.isFinite(ms) ? ms : null
}

function nowPlaying(p: RealtimeDevice['playing']): NowPlaying | null {
  if (!p || typeof p.name !== 'string' || !Number.isFinite(p.since) || !Number.isFinite(p.checkedAt)) return null
  return {
    name: p.name,
    since: p.since,
    accuracyMs: typeof p.accuracyMs === 'number' && Number.isFinite(p.accuracyMs) ? p.accuracyMs : null,
    checkedAt: p.checkedAt,
  }
}

// GET /api/admin/monitor/feed?devices=a,b,c — for every screen on the wall, its
// newest play reports, whether it is connected, and what it says it's playing,
// in one request. Asking also keeps the Realtime Server checking these screens.
// serverTime lets the browser correct its clock.
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
  const [results, status, seen] = await Promise.all([
    Promise.all(ids.map((id) =>
      db.from('play_logs')
        .select('program_id, program_name, began_at, duration_seconds, received_at')
        .eq('device_id', id)
        .order('began_at', { ascending: false })
        .limit(REPORTS_PER_SCREEN),
    )),
    ids.length > 0 ? watchScreens(ids, STATUS_TIMEOUT_MS) : Promise.resolve({ error: 'No screens' }),
    ids.length > 0 ? db.from('devices').select('id, last_seen_at').in('id', ids) : Promise.resolve({ data: [] }),
  ])

  const reports: Record<string, PlayReport[]> = {}
  ids.forEach((id, i) => {
    reports[id] = (results[i].data ?? [])
      .map((r) => ({
        pid: (r.program_id as string | null) ?? null,
        name: (r.program_name as string | null) ?? '',
        beganAt: Date.parse(r.began_at as string),
        duration: Number(r.duration_seconds) || 0,
        receivedAt: time(r.received_at as string | null) ?? undefined,
      }))
      .filter((r) => Number.isFinite(r.beganAt))
  })

  // Without the Realtime Server nobody knows who is connected: leave it out
  // rather than call every screen offline.
  let connections: Record<string, Connection> | undefined
  const playing: Record<string, NowPlaying> = {}
  if ('devices' in status) {
    const lastSeen = new Map((seen.data ?? []).map((d) => [d.id as string, d.last_seen_at as string | null]))
    connections = {}
    for (const id of ids) {
      const live = status.devices.get(id)
      connections[id] = {
        online: live?.online ?? false,
        connectedAt: live?.online ? time(live.connectedAt) : null,
        lastSeen: time(live?.lastSeen) ?? time(lastSeen.get(id)),
      }
      const now = live?.online ? nowPlaying(live.playing) : null
      if (now) playing[id] = now
    }
  }

  return NextResponse.json({ serverTime: Date.now(), reports, connections, playing })
}
