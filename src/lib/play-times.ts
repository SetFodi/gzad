// Controllers stamp every play with their own clock. After a power cut, a board
// whose clock battery isn't working starts on a fixed default date (seen:
// 3 Jul 2026 14:35) until the internet sets the time, so the first play or two
// carry an impossible date and land on the wrong day in client reports.
//
// Such plays are moved to when they really happened, as near as we can tell:
// they were played at boot, shortly before the upload, so the last of them is
// taken to have ended just before the batch arrived, and plays that arrived
// together keep their spacing. Correctly stamped plays in the same batch are
// no guide: they can be a backlog from before the power cut (seen on
// y08-s26-60759, whose batch also held plays from 19 minutes earlier).

/** Stamped this far after it arrived: the clock was ahead. */
export const AHEAD_LIMIT_MS = 10 * 60 * 1000
/** Stamped this far before it arrived: older than any offline backlog, so the clock was behind. */
export const BEHIND_LIMIT_MS = 30 * 24 * 60 * 60 * 1000

export function isImpossibleStamp(stampMs: number, receivedMs: number): boolean {
  return stampMs > receivedMs + AHEAD_LIMIT_MS || stampMs < receivedMs - BEHIND_LIMIT_MS
}

export interface StampedPlay {
  beganAtMs: number
  durationSeconds: number
}

/** For each play, its corrected start time in ms, or null when its stamp is plausible. */
export function correctPlayTimes(plays: StampedPlay[], receivedMs: number): (number | null)[] {
  const bad = plays.map(p => isImpossibleStamp(p.beganAtMs, receivedMs))
  if (!bad.includes(true)) return plays.map(() => null)

  const latestBadEnd = Math.max(...plays.filter((_, i) => bad[i]).map(p => p.beganAtMs + p.durationSeconds * 1000))
  const shift = receivedMs - latestBadEnd
  const floor = receivedMs - BEHIND_LIMIT_MS + 1

  return plays.map((p, i) => (bad[i] ? Math.max(p.beganAtMs + shift, floor) : null))
}
