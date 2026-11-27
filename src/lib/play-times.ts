// Controllers stamp every play with their own clock. Right after power-on the
// player starts before the board has loaded its clock, so the first play or two
// carry a default date (seen: 3 Jul 2026 14:35) and would land on the wrong day
// in client reports. This happens with a working clock battery too: on 20 Nov
// y08-s26-60756 kept the right time through a power cut with no internet, yet
// still did it. A board with no battery and no internet stays on that date for
// longer, which is what the clock warning looks for.
//
// Such plays are moved to when they really happened, as near as we can tell:
// they were played at boot, shortly before the upload, so the last of them is
// taken to have ended just before the batch arrived, and plays that arrived
// together keep their spacing. Correctly stamped plays in the same batch are
// no guide: they can be a backlog from before the power cut (seen on
// y08-s26-60759, whose batch also held plays from 19 minutes earlier).
//
// An old stamp alone proves nothing: on 27 Nov y1c-825-61009 came back after a
// month and re-sent 592 plays from 22 Oct that were already stored. Re-dating
// them to "now" duplicated them and, for a live campaign, would have billed
// them again. So a stamp in the past only counts as a clock error when it is
// also from before the screen was registered with us.

/** Stamped this far after it arrived: the clock was ahead. */
export const AHEAD_LIMIT_MS = 10 * 60 * 1000
/** Stamped this far before it arrived, and before the screen existed for us: the clock was behind. */
export const BEHIND_LIMIT_MS = 30 * 24 * 60 * 60 * 1000

/**
 * `firstSeenMs` is when the screen was registered. Without it, any stamp older
 * than BEHIND_LIMIT_MS counts as impossible.
 */
export function isImpossibleStamp(stampMs: number, receivedMs: number, firstSeenMs: number | null = null): boolean {
  if (stampMs > receivedMs + AHEAD_LIMIT_MS) return true
  if (stampMs >= receivedMs - BEHIND_LIMIT_MS) return false
  return firstSeenMs === null || stampMs < firstSeenMs
}

export interface StampedPlay {
  beganAtMs: number
  durationSeconds: number
}

/** For each play, its corrected start time in ms, or null when its stamp is plausible. */
export function correctPlayTimes(plays: StampedPlay[], receivedMs: number, firstSeenMs: number | null = null): (number | null)[] {
  const bad = plays.map(p => isImpossibleStamp(p.beganAtMs, receivedMs, firstSeenMs))
  if (!bad.includes(true)) return plays.map(() => null)

  const latestBadEnd = Math.max(...plays.filter((_, i) => bad[i]).map(p => p.beganAtMs + p.durationSeconds * 1000))
  const shift = receivedMs - latestBadEnd
  const floor = receivedMs - BEHIND_LIMIT_MS + 1

  return plays.map((p, i) => (bad[i] ? Math.max(p.beganAtMs + shift, floor) : null))
}

/**
 * Drops plays this screen already reported. A play is known when a stored row
 * has its stamp as the time it played (stored as sent) or as the stamp it
 * reported (stored corrected). Keys are program name and stamp.
 */
export function withoutKnownPlays<T extends { program_name: string; began_at: string; reported_began_at: string | null }>(
  rows: T[],
  stored: { program_name: string; began_at?: string | null; reported_began_at?: string | null }[],
): T[] {
  const key = (name: string, iso: string) => `${name}|${Date.parse(iso)}`
  const known = new Set<string>()
  for (const s of stored) {
    if (s.began_at) known.add(key(s.program_name, s.began_at))
    if (s.reported_began_at) known.add(key(s.program_name, s.reported_began_at))
  }
  return rows.filter(r => !known.has(key(r.program_name, r.reported_began_at ?? r.began_at)))
}
