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
