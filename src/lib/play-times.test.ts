import { describe, expect, it } from 'vitest'
import { correctPlayTimes, isImpossibleStamp } from './play-times'

const at = (iso: string) => Date.parse(iso)

describe('impossible play stamps', () => {
  const received = at('2026-11-20T18:35:08Z')

  it('flags the default boot date and clocks running ahead, not late uploads', () => {
    expect(isImpossibleStamp(at('2026-07-03T10:35:32Z'), received)).toBe(true)   // default date after a power cut
    expect(isImpossibleStamp(at('2026-11-20T19:00:00Z'), received)).toBe(true)   // 25 min in the future
    expect(isImpossibleStamp(at('2026-11-17T09:00:00Z'), received)).toBe(false)  // 3 days late: an offline backlog
    expect(isImpossibleStamp(at('2026-11-20T18:40:00Z'), received)).toBe(false)  // a few minutes of clock drift
  })

  it('moves a lone mis-stamped play to just before it arrived', () => {
    const [fixed] = correctPlayTimes([{ beganAtMs: at('2026-07-03T10:35:32Z'), durationSeconds: 10 }], received)
    expect(new Date(fixed!).toISOString()).toBe('2026-11-20T18:34:58.000Z')
  })

  it('keeps the spacing of mis-stamped plays that arrived together', () => {
    const fixed = correctPlayTimes([
      { beganAtMs: at('2025-02-07T03:47:40Z'), durationSeconds: 30 },
      { beganAtMs: at('2025-02-07T03:48:40Z'), durationSeconds: 30 },
    ], at('2026-02-07T10:16:41Z'))
    expect(fixed.map(t => new Date(t!).toISOString())).toEqual(['2026-02-07T10:15:11.000Z', '2026-02-07T10:16:11.000Z'])
  })

  it('ignores correctly stamped plays in the batch, which can be a backlog from before the power cut', () => {
    // y08-s26-60759 on 17 Nov: off 05:56-06:14, uploaded at 06:16:04 (Tbilisi) two
    // plays from before the cut and the boot play stamped 3 Jul.
    const fixed = correctPlayTimes([
      { beganAtMs: at('2026-11-17T01:57:00Z'), durationSeconds: 30 },
      { beganAtMs: at('2026-11-17T01:56:30Z'), durationSeconds: 30 },
      { beganAtMs: at('2026-07-03T10:41:00Z'), durationSeconds: 30 },
    ], at('2026-11-17T02:16:04Z'))
    expect(fixed[0]).toBeNull()
    expect(fixed[1]).toBeNull()
    expect(new Date(fixed[2]!).toISOString()).toBe('2026-11-17T02:15:34.000Z')
  })

  it('leaves a batch with plausible stamps alone', () => {
    expect(correctPlayTimes([{ beganAtMs: at('2026-11-20T18:34:50Z'), durationSeconds: 10 }], received)).toEqual([null])
  })
})
