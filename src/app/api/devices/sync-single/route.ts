import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncDevicePlaylist } from '@/lib/device-sync'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Re-pushes the current playlist for a single device.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (token !== process.env.CALLBACK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { cardId } = await request.json()
  if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 })

  const supabase = getSupabase()
  const result = await syncDevicePlaylist(supabase, cardId)
  console.log(`[sync-single] ${cardId}: pushed=${result.pushed} cleared=${result.cleared} media=${result.media} campaigns=${result.campaigns}`)
  return NextResponse.json(result)
}
