import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Issues a device its own callback key. Called by the Realtime Server when a
// controller connects, so each device authenticates its play-log and GPS
// callbacks with a credential that is worthless for any other device.
//
// Authenticated with the shared secret: the Realtime Server is trusted
// infrastructure, controllers never call this.

const CARD_ID_PATTERN = /^[a-zA-Z0-9_-]{4,64}$/

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!process.env.CALLBACK_SECRET || token !== process.env.CALLBACK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { cardId } = await request.json()
  if (!cardId || typeof cardId !== 'string' || !CARD_ID_PATTERN.test(cardId)) {
    return NextResponse.json({ error: 'Invalid cardId' }, { status: 400 })
  }

  const supabase = getSupabase()

  const { data: existing, error: readError } = await supabase
    .from('devices')
    .select('api_key')
    .eq('id', cardId)
    .maybeSingle()

  // Older databases predate the api_key column — tell the caller to keep using
  // the shared secret rather than failing the device's setup.
  if (readError?.code === '42703') {
    return NextResponse.json({ key: null, reason: 'devices.api_key not present' })
  }
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 })
  }

  if (existing?.api_key) {
    return NextResponse.json({ key: existing.api_key })
  }

  // First time we've seen this controller: create the row and let the column
  // default mint a key.
  const { data: created, error: writeError } = await supabase
    .from('devices')
    .upsert({ id: cardId, name: cardId }, { onConflict: 'id' })
    .select('api_key')
    .maybeSingle()

  if (writeError) {
    return NextResponse.json({ error: writeError.message }, { status: 500 })
  }

  return NextResponse.json({ key: created?.api_key ?? null })
}
