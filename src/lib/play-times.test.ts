import { describe, expect, it } from 'vitest'
import { correctPlayTimes, isImpossibleStamp, withoutKnownPlays } from './play-times'

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

describe('a month-old backlog is not a broken clock', () => {
  const yi = at('2026-02-07T09:33:51Z')            // y1c-825-61009 registered
  const received = at('2026-11-27T17:10:42Z')

  it('keeps the real date of plays from after the screen was registered', () => {
    // 27 Nov: y1c re-sent its 22 Oct log. Those plays were real and already stored.
    expect(isImpossibleStamp(at('2026-10-22T16:30:28Z'), received, yi)).toBe(false)
    expect(correctPlayTimes([{ beganAtMs: at('2026-10-22T18:31:40Z'), durationSeconds: 10 }], received, yi)).toEqual([null])
  })

  it('still moves stamps from before the screen existed for us', () => {
    // Boards added in November that boot stamping 3 Jul, and y1c's 2025 test plays.
    expect(isImpossibleStamp(at('2026-07-03T10:35:32Z'), at('2026-11-20T18:35:08Z'), at('2026-11-17T01:46:08Z'))).toBe(true)
    expect(isImpossibleStamp(at('2025-02-07T03:46:40Z'), at('2026-02-07T09:53:01Z'), yi)).toBe(true)
  })

  it('treats a recent stamp from before registration as a backlog, not a clock error', () => {
    expect(isImpossibleStamp(at('2026-11-16T10:00:00Z'), at('2026-11-20T18:35:08Z'), at('2026-11-17T01:46:08Z'))).toBe(false)
  })

  it('still catches clocks running ahead', () => {
    expect(isImpossibleStamp(at('2026-11-27T17:30:00Z'), received, yi)).toBe(true)
  })
})

describe('withoutKnownPlays', () => {
  const row = (name: string, began: string, reported: string | null = null) => ({ program_name: name, began_at: began, reported_began_at: reported })

  it('drops a re-sent play stored as sent, matching its original stamp', () => {
    const incoming = [row('sunny', '2026-11-27T15:09:19.484Z', '2026-10-22T16:30:28.523Z'), row('sunny', '2026-11-27T15:09:29Z', '2026-10-22T16:30:38Z')]
    const stored = [{ program_name: 'sunny', began_at: '2026-10-22T16:30:28.523+00:00' }]
    expect(withoutKnownPlays(incoming, stored).map(r => r.reported_began_at)).toEqual(['2026-10-22T16:30:38Z'])
  })

  it('drops a re-sent play that was stored corrected', () => {
    const incoming = [row('gzad', '2026-11-20T18:34:58Z', '2026-07-03T10:35:32Z')]
    expect(withoutKnownPlays(incoming, [{ program_name: 'gzad', reported_began_at: '2026-07-03T10:35:32Z' }])).toEqual([])
  })

  it('keeps plays with the same time but another program', () => {
    const incoming = [row('www', '2026-11-27T15:09:19Z', '2026-10-22T16:30:28Z')]
    expect(withoutKnownPlays(incoming, [{ program_name: 'sunny', began_at: '2026-10-22T16:30:28Z' }])).toHaveLength(1)
  })
})
