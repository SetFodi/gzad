import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

// GET /api/devices — list all connected devices from Realtime Server
export async function GET() {
  if (!await verifyAdmin()) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const res = await fetch(`${REALTIME_SERVER_URL}/devices`, {
      headers: { 'Authorization': `Bearer ${REALTIME_SERVER_SECRET}` },
      cache: 'no-store',
    })

    if (!res.ok) throw new Error(`Realtime server: ${res.status}`)
    const devices = await res.json()
    return NextResponse.json(devices)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to reach Realtime Server', devices: [] },
      { status: 502 }
    )
  }
}
