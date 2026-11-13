import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeCardId, serviceClient } from '@/lib/device-admin'

// Asked by the Realtime Server when a controller connects: is this screen in
// the registry? Screens are added on the admin Devices page; anything else is
// turned away even if it knows the connection token.

function bearerMatches(request: NextRequest, secret: string): boolean {
  const header = request.headers.get('authorization') || ''
  const a = Buffer.from(header)
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  const secret = process.env.CALLBACK_SECRET
  if (!secret || !bearerMatches(request, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const cardId = normalizeCardId(body?.cardId)
  if (!cardId) return NextResponse.json({ allowed: false })

  const { data, error } = await serviceClient()
    .from('devices')
    .select('id')
    .eq('id', cardId)
    .maybeSingle()

  // A failed lookup is not a "no": the server keeps screens it already knows.
  if (error) return NextResponse.json({ error: 'Registry unavailable' }, { status: 503 })

  return NextResponse.json({ allowed: Boolean(data) })
}
