import { NextRequest, NextResponse } from 'next/server'
import { CARD_ID, isAdmin, realtime, serviceClient } from '@/lib/live-view-server'
import { expectedProgram, parseProgramTask, type ProgramReason } from '@/lib/live-view'
import { buildGroupPlaylist } from '@/lib/device-sync'

// GET /api/admin/monitor/program?device=<id> — the program a screen is playing.
//
// Asked from the screen itself first: that is what the LED really holds, whoever
// pushed it. When the screen can't answer, fall back to the playlist its group
// should be playing, and say why.
export async function GET(request: NextRequest) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const id = request.nextUrl.searchParams.get('device') ?? ''
  if (!CARD_ID.test(id)) {
    return NextResponse.json({ error: 'Invalid device' }, { status: 400 })
  }

  let reason: ProgramReason = 'not_connected'
  try {
    const status = await realtime(`/devices/${id}`)
    if (status.ok && ((await status.json()) as { online?: boolean }).online) {
      // The command crosses the taxi's mobile link; give it time, but not the
      // server's full 30 s command timeout.
      const res = await realtime(`/devices/${id}/get-program`, { method: 'POST', body: '{}' }, 15_000)
      if (res.ok) {
        const program = parseProgramTask(await res.json())
        if (program) return NextResponse.json({ serverTime: Date.now(), program })
        reason = 'unreadable'
      } else {
        reason = 'no_answer'
      }
    }
  } catch (err) {
    reason = err instanceof Error && err.name === 'TimeoutError' ? 'no_answer' : 'unreachable'
  }

  const db = serviceClient()
  const { data: device } = await db.from('devices').select('group_id').eq('id', id).maybeSingle()
  if (device?.group_id) {
    const playlist = await buildGroupPlaylist(db, device.group_id)
    if (playlist.mediaItems.length > 0) {
      return NextResponse.json({ serverTime: Date.now(), program: expectedProgram(playlist.mediaItems), reason })
    }
  }

  return NextResponse.json({ serverTime: Date.now(), program: null, reason })
}
