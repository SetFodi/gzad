import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deviceEvent, recordEvents, type DeviceEventKind } from '@/lib/system-events'

// Screen connection events from the realtime server (server to server, so it
// authenticates with CALLBACK_SECRET, not a device key). Feeds the admin
// Activity log; a screen's own play reports keep updating last_seen_at.

const KINDS: DeviceEventKind[] = ['connected', 'disconnected', 'restarted', 'setup_failed']
const CARD_ID = /^[A-Za-z0-9._-]{1,64}$/

function authorized(request: NextRequest): boolean {
  const secret = process.env.CALLBACK_SECRET
  const header = request.headers.get('authorization') ?? ''
  if (!secret || !header.startsWith('Bearer ')) return false
  const given = Buffer.from(header.slice(7))
  const expected = Buffer.from(secret)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const cardId = typeof body?.cardId === 'string' ? body.cardId : ''
  const kind = body?.kind as DeviceEventKind
  if (!CARD_ID.test(cardId) || !KINDS.includes(kind)) {
    return NextResponse.json({ error: 'cardId and a known kind are required' }, { status: 400 })
  }

  const at = typeof body.at === 'string' && !Number.isNaN(Date.parse(body.at)) ? new Date(body.at) : new Date()
  const detail = body.detail && typeof body.detail === 'object' && !Array.isArray(body.detail) ? body.detail : {}

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  await recordEvents(supabase, [{ ...deviceEvent(cardId, kind, detail), occurred_at: at.toISOString() }])

  if (kind === 'connected') {
    await supabase.from('devices').update({ last_seen_at: at.toISOString() }).eq('id', cardId)
  }

  return NextResponse.json({ ok: true })
}
