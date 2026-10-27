import { describe, expect, it } from 'vitest'
import {
  activeSources,
  autoGrid,
  DEFAULT_UPLOAD_EVERY_MS,
  expectedProgram,
  findAnchor,
  itemSteps,
  layoutFor,
  locate,
  matchMode,
  MAX_TILES,
  moveOnWall,
  parseProgramTask,
  placeOnWall,
  removeFromWall,
  screenActivity,
  setWallLayout,
  silentAfter,
  uploadGap,
  WALL_LAYOUTS,
  type LiveProgram,
  type PlayReport,
} from './live-view'

// One item per creative, as realtime-server/server.js buildProgram() pushes it.
function item(pid: string, name: string, kind: 'Image' | 'Video', url: string, timeSpan: number) {
  return {
    _id: `item-${pid}`,
    _program: {
      id: pid, name, width: 240, height: 80, totalSize: 1,
      layers: [{ repeat: false, sources: [{
        _type: kind, url, mime: kind === 'Video' ? 'video/mp4' : 'image/png', name: `${name}.x`,
        playTime: 0, timeSpan, left: 0, top: 0, width: 240, height: 80,
      }] }],
    },
    repeatTimes: 1,
    schedules: [],
  }
}

// Campaign "alpha" rotates two creatives; "beta" has one. Two cycles: a1 b a2 b.
const TASK = {
  task: {
    _id: 't1',
    name: 'gzad playlist',
    items: [
      item('p-a1', 'alpha', 'Image', 'https://x.supabase.co/a1.png', 10),
      item('p-b1', 'beta', 'Video', 'https://x.supabase.co/b1.mp4', 20),
      item('p-a2', 'alpha', 'Image', 'https://x.supabase.co/a2.png', 10),
      item('p-b2', 'beta', 'Video', 'https://x.supabase.co/b1.mp4', 20),
    ],
  },
}

// What the controller actually sends back: the task as a JSON string under `data`.
const REPLY = { _id: 'cmd-1', _type: 'success', data: JSON.stringify(TASK) }

const T0 = Date.parse('2026-10-27T12:00:00Z')
function report(pid: string | null, name: string, secondsAfterT0: number, duration: number): PlayReport {
  return { pid, name, beganAt: T0 + secondsAfterT0 * 1000, duration }
}

describe('parseProgramTask', () => {
  it('reads the program out of the controller reply', () => {
    const program = parseProgramTask(REPLY)!
    expect(program.source).toBe('device')
    expect(program.width).toBe(240)
    expect(program.height).toBe(80)
    expect(program.items.map((i) => i.pid)).toEqual(['p-a1', 'p-b1', 'p-a2', 'p-b2'])
    expect(program.items[1].layers[0][0]).toMatchObject({ kind: 'video', url: 'https://x.supabase.co/b1.mp4', seconds: 20 })
    expect(program.items[0].seconds).toBe(10)
  })

  it('accepts the task already parsed or unwrapped', () => {
    expect(parseProgramTask(TASK)?.items).toHaveLength(4)
    expect(parseProgramTask(TASK.task)?.items).toHaveLength(4)
    expect(parseProgramTask(JSON.stringify(TASK))?.items).toHaveLength(4)
  })

  it('returns null for replies with nothing to draw', () => {
    expect(parseProgramTask(null)).toBeNull()
    expect(parseProgramTask({ _type: 'success', data: 'not json' })).toBeNull()
    expect(parseProgramTask({ task: { items: [] } })).toBeNull()
    expect(parseProgramTask({ task: { items: [{ _program: { layers: [] } }] } })).toBeNull()
  })

  it('plays an item set to repeat once per repeat', () => {
    const repeated = { task: { items: [{ ...item('p1', 'solo', 'Image', 'https://x/1.png', 10), repeatTimes: 3 }] } }
    expect(parseProgramTask(repeated)?.items).toHaveLength(3)
  })

  it('bounds the screen size to what a panel can be', () => {
    const odd = (w: unknown, h: unknown) => parseProgramTask({ task: { items: [{ _program: { id: 'p', name: 'n', width: w, height: h, layers: [{ sources: [
      { _type: 'Image', url: 'https://x/1.png', playTime: 0, timeSpan: 10 },
    ] }] } }] } })!
    expect(odd(100000, 80)).toMatchObject({ width: 240, height: 80 })
    expect(odd(-5, 0)).toMatchObject({ width: 240, height: 80 })
    expect(odd(191.6, 64.2)).toMatchObject({ width: 192, height: 64 })
  })

  it('only loads plain web addresses from a screen\'s program', () => {
    const urls = ['javascript:alert(1)', 'file:///etc/passwd', 'data:image/png;base64,AAAA', 'https://x/ok.png']
    const program = parseProgramTask({ task: { items: urls.map((url, i) => ({ _program: { id: `p${i}`, name: 'n', width: 240, height: 80, layers: [{ sources: [
      { _type: 'Image', url, playTime: 0, timeSpan: 10 },
    ] }] } })) } })!
    expect(program.items.map((i) => i.layers[0][0].url)).toEqual([null, null, null, 'https://x/ok.png'])
    expect(program.items.map((i) => i.layers[0][0].kind)).toEqual(['other', 'other', 'other', 'image'])
  })

  it('caps absurd timings', () => {
    const program = parseProgramTask({ task: { items: [{ _program: { id: 'p', name: 'n', width: 240, height: 80, layers: [{ sources: [
      { _type: 'Image', url: 'https://x/1.png', playTime: -4, timeSpan: 1e12 },
    ] }] } }] } })!
    expect(program.items[0].layers[0][0]).toMatchObject({ start: 0, seconds: 86_400 })
  })

  it('keeps content it cannot draw as a labelled placeholder', () => {
    const textItem = { task: { items: [{ _program: { id: 'p', name: 'promo', width: 240, height: 80, layers: [{ sources: [
      { _type: 'MultiLineText', playTime: 0, timeSpan: 8, left: 0, top: 0, width: 240, height: 80 },
    ] }] } }] } }
    const source = parseProgramTask(textItem)!.items[0].layers[0][0]
    expect(source.kind).toBe('other')
    expect(source.label).toBe('MultiLineText')
  })

  it('orders a layer by start time and sizes items to their longest layer', () => {
    const multi = { task: { items: [{ _program: { id: 'p', name: 'm', width: 128, height: 64, layers: [
      { sources: [
        { _type: 'Image', url: 'https://x/2.png', playTime: 5, timeSpan: 5 },
        { _type: 'Image', url: 'https://x/1.png', playTime: 0, timeSpan: 5 },
      ] },
      { sources: [{ _type: 'Image', url: 'https://x/logo.png', playTime: 0, timeSpan: 12, left: 100, top: 0, width: 28, height: 28 }] },
    ] } }] } }
    const program = parseProgramTask(multi)!
    expect(program.width).toBe(128)
    expect(program.items[0].layers[0].map((s) => s.url)).toEqual(['https://x/1.png', 'https://x/2.png'])
    expect(program.items[0].seconds).toBe(12)
    expect(program.items[0].layers[1][0]).toMatchObject({ x: 100, w: 28, h: 28 })
  })
})

describe('matching reports to the program', () => {
  const program = parseProgramTask(REPLY)!

  it('uses program ids when the screen reports them', () => {
    expect(matchMode(program, [report('p-b1', 'beta', 0, 20)])).toBe('pid')
    expect(matchMode(program, [report('unknown', 'beta', 0, 20)])).toBe('name')
  })

  it('anchors on the exact creative even when names repeat', () => {
    const reports = [report('p-a1', 'alpha', 0, 10), report('p-b1', 'beta', 10, 20), report('p-a2', 'alpha', 30, 10)]
    expect(findAnchor(program, reports)).toEqual({ index: 2, beganAt: T0 + 30_000, matchedBy: 'pid', current: true })
  })

  it('falls back to the sequence of names when there are no ids', () => {
    const reports = [report(null, 'beta', 0, 20), report(null, 'alpha', 20, 10), report(null, 'beta', 30, 20)]
    // beta follows alpha in both cycles; either beta is a faithful anchor.
    const anchor = findAnchor(program, reports)!
    expect(anchor.matchedBy).toBe('name')
    expect(program.items[anchor.index].name).toBe('beta')
    expect(anchor.beganAt).toBe(T0 + 30_000)
  })

  it('keeps playing from the newest report that is in this program, and flags it', () => {
    // The newest play isn't in the program we hold (re-pushed, or a stray entry).
    const reports = [report('p-a1', 'alpha', 0, 10), report('p-new', 'someone else', 10, 10)]
    expect(findAnchor(program, reports)).toEqual({ index: 0, beganAt: T0, matchedBy: 'pid', current: false })
  })

  it('has no anchor when nothing reported is in this program', () => {
    expect(findAnchor(program, [report('x1', 'other', 0, 10), report('x2', 'other', 10, 10)])).toBeNull()
  })

  it('matches names the way the play-log callback does', () => {
    const named = expectedProgram([
      { url: 'https://x/a.png', type: 'image/png', duration: 10, campaignName: 'alpha sale' },
      { url: 'https://x/b.png', type: 'image/png', duration: 10, campaignName: 'beta' },
    ])
    expect(findAnchor(named, [report(null, 'Alpha Sale_2', 0, 10)])).toMatchObject({ index: 0, current: true })
  })

  it('has no anchor before the first report', () => {
    expect(findAnchor(program, [])).toBeNull()
  })
})

describe('itemSteps', () => {
  const program = parseProgramTask(REPLY)!

  it('uses the begin-to-begin time the screen really takes', () => {
    const reports = [
      report('p-a1', 'alpha', 0, 10), report('p-b1', 'beta', 10.4, 20),
      report('p-a2', 'alpha', 30.8, 10), report('p-b2', 'beta', 41.2, 20), report('p-a1', 'alpha', 61.6, 10),
    ]
    const steps = itemSteps(program, reports)
    expect(steps[0]).toBeCloseTo(10.4)
    expect(steps[1]).toBeCloseTo(20.4)
    expect(steps[2]).toBeCloseTo(10.4)
  })

  it('ignores a gap that spans a missing report', () => {
    // p-b1 was never reported, so a1 → a2 spans two items.
    const reports = [report('p-a1', 'alpha', 0, 10), report('p-a2', 'alpha', 30, 10)]
    expect(itemSteps(program, reports)[0]).toBe(10)
  })

  it('falls back to the program length with no reports', () => {
    expect(itemSteps(program, [])).toEqual([10, 20, 10, 20])
  })
})

describe('locate', () => {
  const steps = [10, 20, 10, 20] // a 60-second loop
  const anchor = { index: 0, beganAt: T0, matchedBy: 'pid' as const, current: true }

  it('walks forward from the anchor', () => {
    expect(locate(steps, anchor, T0 + 5_000)).toEqual({ index: 0, offset: 5, seconds: 10 })
    expect(locate(steps, anchor, T0 + 12_000)).toEqual({ index: 1, offset: 2, seconds: 20 })
    expect(locate(steps, anchor, T0 + 59_000)).toEqual({ index: 3, offset: 19, seconds: 20 })
  })

  it('wraps around the loop, including long after the anchor', () => {
    expect(locate(steps, anchor, T0 + 60_000)).toEqual({ index: 0, offset: 0, seconds: 10 })
    // 3 h 45 s: whole loops drop out, leaving 45 s: item 3 runs 40–60 s.
    const later = locate(steps, anchor, T0 + (3 * 3600 + 45) * 1000)
    expect(later.index).toBe(3)
    expect(later.offset).toBeCloseTo(5)
  })

  it('starts from a mid-loop anchor', () => {
    expect(locate(steps, { ...anchor, index: 2 }, T0 + 15_000)).toEqual({ index: 3, offset: 5, seconds: 20 })
  })

  it('treats a screen clock ahead of ours as the start of the item', () => {
    expect(locate(steps, anchor, T0 - 3_000)).toEqual({ index: 0, offset: 0, seconds: 10 })
  })

  it('never points outside the program', () => {
    expect(locate(steps, { ...anchor, index: 9 }, T0).index).toBe(1)
    expect(locate([], anchor, T0)).toEqual({ index: 0, offset: 0, seconds: 0 })
  })
})

describe('activeSources', () => {
  const program = parseProgramTask({ task: { items: [{ _program: { id: 'p', name: 'm', width: 240, height: 80, layers: [
    { sources: [
      { _type: 'Image', url: 'https://x/1.png', playTime: 0, timeSpan: 4 },
      { _type: 'Video', url: 'https://x/2.mp4', playTime: 4, timeSpan: 6 },
    ] },
    { sources: [{ _type: 'Image', url: 'https://x/badge.png', playTime: 2, timeSpan: 3 }] },
  ] } }] } })!
  const it0 = program.items[0]

  it('plays a layer\'s sources one after another', () => {
    expect(activeSources(it0, 1).map((a) => a.source.url)).toEqual(['https://x/1.png'])
    const later = activeSources(it0, 6)
    expect(later[0]).toMatchObject({ offset: 2 })
    expect(later[0].source.url).toBe('https://x/2.mp4')
  })

  it('stacks layers and holds a finished layer on its last frame', () => {
    expect(activeSources(it0, 3).map((a) => a.source.url)).toEqual(['https://x/1.png', 'https://x/badge.png'])
    expect(activeSources(it0, 9).map((a) => a.source.url)).toEqual(['https://x/2.mp4', 'https://x/badge.png'])
  })
})

describe('whether a screen is playing', () => {
  const MIN = 60_000
  const T = Date.UTC(2026, 9, 27, 12, 0, 0)
  // 15-second plays, uploaded in batches that arrive at the given minutes past T.
  const batches = (...minutes: number[]): PlayReport[] =>
    minutes.flatMap((m) => [0, 1, 2].map((k) => ({
      pid: 'p', name: 'alpha', beganAt: T + m * MIN - (3 - k) * 15_000, duration: 15, receivedAt: T + m * MIN,
    })))
  const online = (connectedAt: number | null = T - 60 * MIN) => ({ online: true, connectedAt, lastSeen: T })

  it('measures the screen\'s own upload pace once three batches are in', () => {
    expect(uploadGap(batches(0, 1))).toBe(DEFAULT_UPLOAD_EVERY_MS)
    expect(uploadGap(batches(0, 1, 2, 3))).toBe(MIN)
    // Uneven uploads: the longest regular wait counts, an outage doesn't.
    expect(uploadGap(batches(0, 1, 3, 4))).toBe(2 * MIN)
    expect(uploadGap(batches(0, 5, 10, 120))).toBe(5 * MIN)
    // Two upload paths a few seconds apart are one batch.
    expect(uploadGap([...batches(0, 1, 2), ...batches(0.1)])).toBe(MIN)
  })

  it('allows one upload wait plus slack before calling a screen silent', () => {
    expect(silentAfter(batches(0, 1, 2))).toBe(2 * MIN)
    expect(silentAfter(batches(0, 5, 10))).toBe(6.25 * MIN)
  })

  it('is offline whenever the Realtime Server says so, however fresh the reports', () => {
    const reports = batches(0, 5, 10)
    expect(screenActivity({ online: false, connectedAt: null, lastSeen: T + 9 * MIN }, reports, T + 10 * MIN))
      .toEqual({ state: 'offline', since: T + 9 * MIN })
  })

  it('plays while uploads arrive on time, and goes silent when they stop', () => {
    const reports = batches(0, 5, 10)
    expect(screenActivity(online(), reports, T + 16 * MIN)).toEqual({ state: 'reporting', since: T + 10 * MIN })
    expect(screenActivity(online(), reports, T + 17 * MIN)).toEqual({ state: 'silent', since: T + 10 * MIN })
  })

  it('without live status, the uploads alone decide', () => {
    const reports = batches(0, 1, 2)
    expect(screenActivity(undefined, reports, T + 3 * MIN).state).toBe('reporting')
    expect(screenActivity(undefined, reports, T + 5 * MIN).state).toBe('silent')
  })

  it('waits for the first upload after a reconnect instead of replaying old reports', () => {
    const reports = batches(0, 5, 10)
    const back = T + 60 * MIN
    expect(screenActivity(online(back), reports, back + 2 * MIN)).toEqual({ state: 'connecting', since: back })
    expect(screenActivity(online(back), reports, back + 7 * MIN)).toEqual({ state: 'silent', since: T + 10 * MIN })
  })

  it('keeps playing through a short reconnect when its uploads are still on time', () => {
    const reports = batches(0, 5, 10)
    expect(screenActivity(online(T + 12 * MIN), reports, T + 13 * MIN).state).toBe('reporting')
  })
})

describe('expectedProgram', () => {
  it('builds a full-screen item per playlist entry', () => {
    const program: LiveProgram = expectedProgram([
      { url: 'https://x/a.png', type: 'image/png', duration: 10, campaignName: 'alpha' },
      { url: 'https://x/b.mp4', type: 'video/mp4', duration: 30, campaignName: 'beta' },
    ])
    expect(program.source).toBe('expected')
    expect(program.items.map((i) => [i.pid, i.name, i.seconds])).toEqual([[null, 'alpha', 10], [null, 'beta', 30]])
    expect(program.items[1].layers[0][0]).toMatchObject({ kind: 'video', w: 240, h: 80 })
  })
})

describe('wall layout', () => {
  it('sizes wide LED tiles as large as the area allows', () => {
    expect(autoGrid(1, 1600, 900, 3)).toEqual({ cols: 1, rows: 1 })
    expect(autoGrid(6, 1600, 900, 3)).toEqual({ cols: 2, rows: 3 })
    expect(autoGrid(12, 1600, 900, 3)).toEqual({ cols: 3, rows: 4 })
    // A tall, narrow area (a phone) stacks them.
    expect(autoGrid(4, 390, 2000, 3)).toEqual({ cols: 1, rows: 4 })
  })

  it('picks the smallest fixed layout that fits', () => {
    expect(WALL_LAYOUTS[layoutFor(1)]).toEqual({ cols: 1, rows: 1 })
    expect(WALL_LAYOUTS[layoutFor(5)]).toEqual({ cols: 2, rows: 3 })
    expect(WALL_LAYOUTS[layoutFor(99)]).toEqual({ cols: 4, rows: 6 })
  })
})

describe('wall state', () => {
  const fixed = (layout: number, slots: (string | null)[]) => ({ layout, slots })

  it('appends to an auto wall and skips screens already on it', () => {
    const { wall, added } = placeOnWall({ layout: 'auto', slots: ['a'] }, ['a', 'b', 'c'])
    expect(wall.slots).toEqual(['a', 'b', 'c'])
    expect(added).toEqual(['b', 'c'])
  })

  it('fills empty cells of a fixed layout from the drop point', () => {
    const { wall } = placeOnWall(fixed(2, ['a', null, null, null]), ['b', 'c'], 2)
    expect(wall.slots).toEqual(['a', null, 'b', 'c'])
  })

  it('replaces the screen in a cell when one is dropped on it', () => {
    const { wall } = placeOnWall(fixed(2, ['a', 'b', null, null]), ['x'], 1)
    expect(wall.slots).toEqual(['a', 'x', null, null])
  })

  it('grows a full fixed layout to fit a whole group', () => {
    const { wall, added } = placeOnWall(fixed(2, ['a', 'b', 'c', 'd']), ['e', 'f'])
    expect(WALL_LAYOUTS[wall.layout as number]).toEqual({ cols: 2, rows: 3 })
    expect(wall.slots).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(added).toEqual(['e', 'f'])
  })

  it('reports what did not fit on the largest layout', () => {
    const full = Array.from({ length: MAX_TILES }, (_, i) => `s${i}`)
    expect(placeOnWall({ layout: 'auto', slots: full }, ['extra']).overflow).toBe(1)
  })

  it('leaves a gap on a fixed layout and closes it on auto', () => {
    expect(removeFromWall(fixed(2, ['a', 'b', 'c', null]), 1).slots).toEqual(['a', null, 'c', null])
    expect(removeFromWall({ layout: 'auto', slots: ['a', 'b', 'c'] }, 1).slots).toEqual(['a', 'c'])
  })

  it('swaps tiles, including into an empty cell', () => {
    expect(moveOnWall(fixed(2, ['a', 'b', null, null]), 0, 3).slots).toEqual([null, 'b', null, 'a'])
    expect(moveOnWall({ layout: 'auto', slots: ['a', 'b', 'c'] }, 0, 2).slots).toEqual(['c', 'b', 'a'])
  })

  it('switches layouts without losing screens that still fit', () => {
    const big = fixed(3, ['a', null, 'b', null, null, null])
    expect(setWallLayout(big, 2).wall.slots).toEqual(['a', null, 'b', null])
    expect(setWallLayout(fixed(2, ['a', 'b', 'c', 'd']), 0)).toEqual({ wall: { layout: 0, slots: ['a'] }, dropped: 3 })
    expect(setWallLayout(fixed(2, ['a', null, 'b', null]), 'auto').wall).toEqual({ layout: 'auto', slots: ['a', 'b'] })
  })
})
