import { NextRequest, NextResponse } from 'next/server'
import { fetchDeviceAddress, fetchPendingScreens, normalizeCardId, notifyRegistryChange, requireDeviceManager } from '@/lib/device-admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/admin/devices — may this user add screens, the LEDOK address a new
// screen needs, and the screens asking to join. Admins who aren't device
// managers get canManage: false and nothing else.
export async function GET() {
  const check = await requireDeviceManager()
  if (!check.ok) {
    if (check.status === 403) return NextResponse.json({ canManage: false, address: null, pending: [] })
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const [address, waiting] = await Promise.all([fetchDeviceAddress(), fetchPendingScreens()])

  // The server may still list a screen added a moment ago.
  let pending = waiting
  if (waiting.length) {
    const { data } = await check.db.from('devices').select('id').in('id', waiting.map(p => p.cardId))
    const added = new Set((data ?? []).map(d => d.id))
    pending = waiting.filter(p => !added.has(p.cardId))
  }

  return NextResponse.json({ canManage: true, address, pending })
}

// POST /api/admin/devices — add a screen: { cardId, name?, groupId? }
export async function POST(request: NextRequest) {
  const check = await requireDeviceManager()
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

  const body = await request.json().catch(() => null)
  const cardId = normalizeCardId(body?.cardId)
  if (!cardId) {
    return NextResponse.json({ error: 'Enter the screen ID as LEDOK shows it, for example y08-s26-60755' }, { status: 400 })
  }
  const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : cardId
  const groupId = typeof body?.groupId === 'string' && body.groupId ? body.groupId : null
  if (groupId && !UUID_PATTERN.test(groupId)) {
    return NextResponse.json({ error: 'Unknown group' }, { status: 400 })
  }

  const { error } = await check.db.from('devices').insert({ id: cardId, name, group_id: groupId })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'This screen is already added' }, { status: 409 })
    if (error.code === '23503') return NextResponse.json({ error: 'Unknown group' }, { status: 400 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // The server may have turned this controller away moments ago; let it in
  // on the next attempt instead of after the cache expires.
  await notifyRegistryChange(cardId)

  return NextResponse.json({ cardId, name, address: await fetchDeviceAddress() }, { status: 201 })
}

// DELETE /api/admin/devices?cardId=… — remove a screen. Its play history stays;
// the controller is disconnected and can't reconnect until added again.
export async function DELETE(request: NextRequest) {
  const check = await requireDeviceManager()
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

  const cardId = normalizeCardId(request.nextUrl.searchParams.get('cardId'))
  if (!cardId) return NextResponse.json({ error: 'Invalid screen ID' }, { status: 400 })

  const { data, error } = await check.db.from('devices').delete().eq('id', cardId).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Screen not found' }, { status: 404 })

  await notifyRegistryChange(cardId, true)
  return NextResponse.json({ removed: cardId })
}
