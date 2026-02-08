import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const REALTIME_SERVER_URL = process.env.REALTIME_SERVER_URL || 'http://localhost:8081'
const REALTIME_SERVER_SECRET = process.env.REALTIME_SERVER_SECRET || ''

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: admin } = await supabase
    .from('clients')
    .select('is_admin')
    .eq('auth_user_id', user.id)
    .single()

  return admin?.is_admin === true
}

// POST /api/devices/command — proxy a command to a device via Realtime Server
// Body: { cardId, action, ...params }
// Actions: brightness, screen, info, push-program, setup-callbacks
export async function POST(request: NextRequest) {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const body = await request.json()
  const { cardId, action, ...params } = body

  if (!cardId || !action) {
    return NextResponse.json({ error: 'cardId and action are required' }, { status: 400 })
  }

  // Map action to Realtime Server endpoint
  const endpointMap: Record<string, string> = {
    'brightness': `/devices/${cardId}/brightness`,
    'screen': `/devices/${cardId}/screen`,
    'info': `/devices/${cardId}/info`,
    'push-program': `/devices/${cardId}/push-program`,
    'setup-callbacks': `/devices/${cardId}/setup-callbacks`,
    'raw': `/command/${cardId}`,
  }

  const endpoint = endpointMap[action]
  if (!endpoint) {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }

  try {
    const res = await fetch(`${REALTIME_SERVER_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${REALTIME_SERVER_SECRET}`,
      },
      body: JSON.stringify(params),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to reach Realtime Server' },
      { status: 502 }
    )
  }
}
