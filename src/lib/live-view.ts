// Live view: rebuilds what a screen is showing from the program it holds and
// the play reports it uploads. The controllers cannot stream their output, so
// this is a replay at the LED's own resolution, positioned in real time:
//
//   play reports  →  which item started when (the anchor), and how long each
//                    item really runs on that screen
//   program       →  what each item draws, and the order they loop in
//
// Reports arrive in batches (every 5 minutes), so between batches the position
// is projected forward through the loop and corrected when the next batch lands.
// A screen only plays while it is connected and its batches keep arriving: an
// offline or silent screen is shown dark, never as a guess.
// Pure functions only: the API uses the parser, the browser uses the rest.

export const DEFAULT_WIDTH = 240
export const DEFAULT_HEIGHT = 80

/** The upload interval the Realtime Server gives each screen, until a screen's own pace is measured. */
export const DEFAULT_UPLOAD_EVERY_MS = 5 * 60_000

export type SourceKind = 'image' | 'video' | 'other'

export interface LiveSource {
  kind: SourceKind
  url: string | null
  mime: string
  /** Shown in place of content the browser can't draw, such as text or clocks. */
  label: string
  /** Seconds from the start of the item. */
  start: number
  seconds: number
  /** Position and size in screen pixels. */
  x: number
  y: number
  w: number
  h: number
}

export interface LiveItem {
  /** Program id the screen puts in its play reports; null for an expected playlist. */
  pid: string | null
  name: string
  /** Length according to the program. The screen's real timing comes from reports. */
  seconds: number
  /** Layers draw bottom to top; inside a layer, sources play one after another. */
  layers: LiveSource[][]
}

export interface LiveProgram {
  /** 'device': read back from the screen. 'expected': what its group should play. */
  source: 'device' | 'expected'
  name: string
  width: number
  height: number
  items: LiveItem[]
}

/** Why a screen's program came from somewhere other than the screen itself. */
export type ProgramReason = 'not_connected' | 'no_answer' | 'unreadable' | 'unreachable'

export interface PlayReport {
  pid: string | null
  name: string
  /** Epoch milliseconds, by the screen's clock. */
  beganAt: number
  /** Seconds. */
  duration: number
  /** Epoch milliseconds, by the server's clock: when the upload holding this report arrived. */
  receivedAt?: number
}

/** What the Realtime Server knows about a screen's connection. Times are by the server's clock. */
export interface Connection {
  online: boolean
  /** When the current connection opened; null while offline. */
  connectedAt: number | null
  /** When the screen was last heard from. */
  lastSeen: number | null
}

type Json = Record<string, unknown>

const num = (value: unknown, fallback: number): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}
const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value))

/** LED panels are small; anything past this is a corrupt program, not a screen. */
const MAX_SIDE = 2048
/** One source or item longer than a day is a corrupt program, not an ad. */
const MAX_SECONDS = 86_400

/** Screen dimension from a program: whole pixels, within what a panel can be. */
function side(value: unknown): number {
  const n = Math.round(num(value, 0))
  return n >= 1 && n <= MAX_SIDE ? n : 0
}

/**
 * Media URLs come from the screen's own program, so only plain web addresses
 * are loaded. Anything else (file:, data:, javascript:) is shown as a placeholder.
 */
export function safeUrl(value: unknown): string | null {
  const url = text(value).trim()
  return /^https?:\/\//i.test(url) ? url : null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// ─── Reading the program a screen holds ──────────────────────────────────────

/**
 * Finds the task inside whatever getProgramTask returned. The controller wraps it
 * as { data: "<json string>" } holding { task: { items } }; tolerate the layers
 * arriving already parsed or unwrapped.
 */
function unwrapTask(raw: unknown): Json | null {
  let value: unknown = raw
  for (let depth = 0; depth < 6 && value; depth++) {
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value)
      } catch {
        return null
      }
      continue
    }
    if (typeof value !== 'object') return null
    const obj = value as Json
    if (Array.isArray(obj.items)) return obj
    value = obj.task ?? obj.data ?? obj.result ?? null
  }
  return null
}

function parseSource(raw: unknown, width: number, height: number): LiveSource | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Json
  const type = text(s._type).toLowerCase()
  const mime = text(s.mime)
  const url = safeUrl(s.url)
  const kind: SourceKind =
    type === 'video' || mime.startsWith('video') ? 'video'
      : type === 'image' || mime.startsWith('image') ? 'image'
        : 'other'
  return {
    kind: url ? kind : 'other',
    url,
    mime,
    label: text(s.name) || text(s._type) || 'Content',
    start: clamp(num(s.playTime, 0), 0, MAX_SECONDS),
    seconds: clamp(num(s.timeSpan, 10), 0.5, MAX_SECONDS),
    x: num(s.left, 0),
    y: num(s.top, 0),
    w: num(s.width, width),
    h: num(s.height, height),
  }
}

/** Turns a getProgramTask reply into a program, or null if it holds nothing drawable. */
export function parseProgramTask(raw: unknown): LiveProgram | null {
  const task = unwrapTask(raw)
  if (!task) return null

  let width = 0
  let height = 0
  const items: LiveItem[] = []

  for (const entry of task.items as unknown[]) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Json
    const program = (item._program && typeof item._program === 'object' ? item._program : {}) as Json
    width ||= side(program.width)
    height ||= side(program.height)
    const w = side(program.width) || width || DEFAULT_WIDTH
    const h = side(program.height) || height || DEFAULT_HEIGHT

    const layers: LiveSource[][] = []
    for (const layer of Array.isArray(program.layers) ? program.layers : []) {
      const sources = Array.isArray((layer as Json)?.sources) ? ((layer as Json).sources as unknown[]) : []
      const parsed = sources
        .map((s) => parseSource(s, w, h))
        .filter((s): s is LiveSource => s !== null)
        .sort((a, b) => a.start - b.start)
      if (parsed.length > 0) layers.push(parsed)
    }
    if (layers.length === 0) continue

    const parsedItem: LiveItem = {
      pid: text(program.id) || text(item._id) || null,
      name: text(program.name) || text(task.name),
      seconds: Math.max(1, ...layers.flat().map((s) => s.start + s.seconds)),
      layers,
    }
    // An item set to repeat plays back to back, and each pass is reported.
    const repeats = clamp(Math.round(num(item.repeatTimes, 1)), 1, 10)
    for (let r = 0; r < repeats; r++) items.push(parsedItem)
  }

  if (items.length === 0) return null
  return {
    source: 'device',
    name: text(task.name),
    width: width || DEFAULT_WIDTH,
    height: height || DEFAULT_HEIGHT,
    items,
  }
}

/** The playlist a screen's group should be playing, when the screen can't be asked. */
export function expectedProgram(
  media: { url: string; type: string; duration: number; campaignName: string }[],
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
): LiveProgram {
  return {
    source: 'expected',
    name: 'gzad playlist',
    width,
    height,
    items: media.map((m) => ({
      pid: null,
      name: m.campaignName,
      seconds: m.duration,
      layers: [[{
        kind: safeUrl(m.url) ? (m.type.startsWith('video') ? 'video' : 'image') : 'other',
        url: safeUrl(m.url),
        mime: m.type,
        label: m.campaignName,
        start: 0,
        seconds: m.duration,
        x: 0,
        y: 0,
        w: width,
        h: height,
      }]],
    })),
  }
}

// ─── Lining reports up with the program ──────────────────────────────────────

export type MatchMode = 'pid' | 'name'

/**
 * Match by program id when any report's id is in the program: that identifies
 * the exact item, even among rotating creatives of one campaign. Otherwise fall
 * back to names, which is all an expected playlist has.
 */
export function matchMode(program: LiveProgram, reports: PlayReport[]): MatchMode {
  const pids = new Set(program.items.map((i) => i.pid).filter(Boolean))
  return reports.some((r) => r.pid && pids.has(r.pid)) ? 'pid' : 'name'
}

/**
 * Names compare the way the play-log callback matches them to campaigns:
 * case-insensitive, ignoring the _N suffix older programs appended.
 */
function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/_\d+$/, '')
  return norm(a) === norm(b)
}

function matches(mode: MatchMode, item: LiveItem, report: PlayReport): boolean {
  return mode === 'pid' ? item.pid !== null && item.pid === report.pid : sameName(item.name, report.name)
}

/**
 * How long each item really occupies on this screen, in seconds. Begin-to-begin
 * time between an item and its successor is best (it includes the switch-over);
 * then the reported play length; then the program's own length.
 */
export function itemSteps(program: LiveProgram, reports: PlayReport[]): number[] {
  const mode = matchMode(program, reports)
  const chrono = [...reports].sort((a, b) => a.beganAt - b.beganAt)
  const n = program.items.length

  return program.items.map((item, i) => {
    const next = program.items[(i + 1) % n]
    const gaps: number[] = []
    const lengths: number[] = []
    for (let k = 0; k < chrono.length; k++) {
      if (!matches(mode, item, chrono[k])) continue
      lengths.push(chrono[k].duration)
      const after = chrono[k + 1]
      if (after && matches(mode, next, after)) gaps.push((after.beganAt - chrono[k].beganAt) / 1000)
    }
    // Ignore gaps that span a missing report or a pause.
    const gap = median(gaps.filter((g) => g >= item.seconds * 0.5 && g <= item.seconds * 2.5 + 2))
    if (gap !== null) return gap
    const length = median(lengths.filter((l) => l >= item.seconds * 0.5 && l <= item.seconds * 2 + 1))
    return length ?? item.seconds
  })
}

export interface Anchor {
  index: number
  beganAt: number
  matchedBy: MatchMode
  /**
   * False when the newest report isn't in this program: either the program was
   * re-pushed and we hold the old one, or the screen hasn't reported the new one yet.
   */
  current: boolean
}

/**
 * The item the newest report from this program refers to. Null when the screen
 * hasn't reported anything this program contains.
 */
export function findAnchor(program: LiveProgram, reports: PlayReport[]): Anchor | null {
  if (reports.length === 0 || program.items.length === 0) return null
  const mode = matchMode(program, reports)
  const all = [...reports].sort((a, b) => b.beganAt - a.beganAt)
  const n = program.items.length

  // Skip reports from another program, so an anchor survives a stray entry.
  const from = all.findIndex((r) => program.items.some((item) => matches(mode, item, r)))
  if (from === -1) return null
  const desc = all.slice(from)
  const latest = desc[0]

  const candidates = program.items.flatMap((item, i) => (matches(mode, item, latest) ? [i] : []))

  // Several items look alike (repeats, or name-only matching): prefer the one
  // whose predecessors explain the reports that came just before.
  let best = candidates[0]
  let bestScore = -1
  for (const c of candidates) {
    let score = 0
    for (let k = 1; k < Math.min(desc.length, 9); k++) {
      if (matches(mode, program.items[(((c - k) % n) + n) % n], desc[k])) score++
    }
    if (score > bestScore) {
      best = c
      bestScore = score
    }
  }
  return { index: best, beganAt: latest.beganAt, matchedBy: mode, current: from === 0 }
}

export interface Position {
  index: number
  /** Seconds into the current item. */
  offset: number
  /** How long the current item runs on this screen. */
  seconds: number
}

/** Where the loop is at `now`, walking forward from the anchor. */
export function locate(steps: number[], anchor: Anchor, now: number): Position {
  const n = steps.length
  if (n === 0) return { index: 0, offset: 0, seconds: 0 }
  const cycle = steps.reduce((sum, s) => sum + s, 0)
  let t = Math.max(0, (now - anchor.beganAt) / 1000)
  let i = ((anchor.index % n) + n) % n
  // Every whole loop lands back on the anchor item, so skip them in one step.
  if (cycle > 0 && t >= cycle) t %= cycle
  for (let guard = 0; guard <= n && t >= steps[i]; guard++) {
    t -= steps[i]
    i = (i + 1) % n
  }
  return { index: i, offset: t, seconds: steps[i] }
}

/** What each layer of an item shows `offset` seconds in. A finished layer holds its last frame. */
export function activeSources(item: LiveItem, offset: number): { source: LiveSource; offset: number }[] {
  const active: { source: LiveSource; offset: number }[] = []
  for (const layer of item.layers) {
    let chosen: LiveSource | null = null
    for (const source of layer) {
      if (offset >= source.start) chosen = source
      if (offset < source.start + source.seconds && offset >= source.start) break
    }
    if (chosen) active.push({ source: chosen, offset: Math.max(0, offset - chosen.start) })
  }
  return active
}

// ─── Whether it is playing at all ────────────────────────────────────────────

/** Uploads closer together than this are one batch, not the screen's pace. */
const SAME_BATCH_MS = 20_000
/** Waits longer than this between batches are outages, not the screen's pace. */
const MAX_UPLOAD_EVERY_MS = 65 * 60_000

/**
 * How long this screen goes between uploads while it plays normally: the
 * longest wait between the batches we hold. A batch is stored in one insert, so
 * its reports share a receive time. The longest wait rather than the typical
 * one, so uneven uploads don't read as silence. Until three batches are in,
 * the configured interval is assumed.
 */
export function uploadGap(reports: PlayReport[]): number {
  const times = [...new Set(reports.flatMap((r) => (r.receivedAt === undefined ? [] : [r.receivedAt])))]
    .sort((a, b) => a - b)
  const gaps: number[] = []
  for (let k = 1; k < times.length; k++) {
    const gap = times[k] - times[k - 1]
    if (gap >= SAME_BATCH_MS && gap <= MAX_UPLOAD_EVERY_MS) gaps.push(gap)
  }
  return gaps.length >= 2 ? Math.max(...gaps) : DEFAULT_UPLOAD_EVERY_MS
}

/** How long after its last upload a connected screen counts as silent. */
export function silentAfter(reports: PlayReport[]): number {
  const gap = uploadGap(reports)
  return gap + Math.max(60_000, gap / 4)
}

export type Activity =
  /** Not connected to the Realtime Server. */
  | { state: 'offline'; since: number | null }
  /** Back after a break, and its first upload since isn't due yet. */
  | { state: 'connecting'; since: number }
  /** Its uploads stopped: it has played nothing since `since`. */
  | { state: 'silent'; since: number | null }
  /** Its uploads arrive on time. */
  | { state: 'reporting'; since: number }

/**
 * Whether a screen is playing at all. A screen uploads only what it played, so
 * an upload that doesn't come means nothing played. `connection` is undefined
 * when the Realtime Server can't be asked; the uploads alone decide then.
 * `now` is by the server's clock.
 */
export function screenActivity(connection: Connection | undefined, reports: PlayReport[], now: number): Activity {
  if (connection && !connection.online) return { state: 'offline', since: connection.lastSeen }

  const last = reports.reduce<number | null>((max, r) => {
    const at = r.receivedAt ?? r.beganAt + r.duration * 1000
    return max === null || at > max ? at : max
  }, null)
  const limit = silentAfter(reports)
  if (last !== null && now - last <= limit) return { state: 'reporting', since: last }

  // Reconnected after a break: its uploads are overdue only because it was away.
  const connectedAt = connection?.connectedAt ?? null
  if (connectedAt !== null && (last === null || connectedAt > last) && now - connectedAt <= limit) {
    return { state: 'connecting', since: connectedAt }
  }
  return { state: 'silent', since: last }
}

// ─── Wall layout ──────────────────────────────────────────────────────────────

export interface GridSize {
  cols: number
  rows: number
}

/** Fixed layouts, sized for wide LED tiles rather than 16:9 cameras. */
export const WALL_LAYOUTS: GridSize[] = [
  { cols: 1, rows: 1 },
  { cols: 1, rows: 2 },
  { cols: 2, rows: 2 },
  { cols: 2, rows: 3 },
  { cols: 2, rows: 4 },
  { cols: 3, rows: 4 },
  { cols: 3, rows: 6 },
  { cols: 4, rows: 6 },
]

export const MAX_TILES = WALL_LAYOUTS[WALL_LAYOUTS.length - 1].cols * WALL_LAYOUTS[WALL_LAYOUTS.length - 1].rows

/** The grid that makes `count` tiles of the given aspect as large as possible in the area. */
export function autoGrid(count: number, width: number, height: number, aspect: number): GridSize {
  if (count <= 1 || width <= 0 || height <= 0) return { cols: 1, rows: 1 }
  let best: GridSize = { cols: 1, rows: count }
  let bestWidth = 0
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols)
    const tileWidth = Math.min(width / cols, (height / rows) * aspect)
    if (tileWidth > bestWidth + 0.5) {
      best = { cols, rows }
      bestWidth = tileWidth
    }
  }
  return best
}

/** The smallest fixed layout with room for `count` tiles. */
export function layoutFor(count: number): number {
  const index = WALL_LAYOUTS.findIndex((l) => l.cols * l.rows >= count)
  return index === -1 ? WALL_LAYOUTS.length - 1 : index
}

// ─── Wall state ──────────────────────────────────────────────────────────────
// 'auto' keeps a compact list of screens and sizes the grid to fit them. A fixed
// layout has a cell per position, empty ones as null, like camera software.

export interface Wall {
  layout: 'auto' | number
  slots: (string | null)[]
}

export const EMPTY_WALL: Wall = { layout: 'auto', slots: [] }

function capacity(layout: number): number {
  return WALL_LAYOUTS[layout].cols * WALL_LAYOUTS[layout].rows
}

function pad(slots: (string | null)[], size: number): (string | null)[] {
  return [...slots, ...Array<null>(Math.max(0, size - slots.length)).fill(null)].slice(0, size)
}

/**
 * Puts screens on the wall. Screens already on it are skipped. On a fixed
 * layout they fill empty cells from `at` onwards, growing the layout when it
 * runs out of room. A single screen dropped on an occupied cell replaces it.
 */
export function placeOnWall(wall: Wall, ids: string[], at?: number): { wall: Wall; added: string[]; overflow: number } {
  const fresh = [...new Set(ids)].filter((id) => !wall.slots.includes(id))
  if (fresh.length === 0) return { wall, added: [], overflow: 0 }

  if (wall.layout === 'auto') {
    const slots = wall.slots.filter((s): s is string => s !== null)
    const room = MAX_TILES - slots.length
    const placed = fresh.slice(0, Math.max(0, room))
    const index = at === undefined ? slots.length : Math.min(Math.max(0, at), slots.length)
    slots.splice(index, 0, ...placed)
    return { wall: { layout: 'auto', slots }, added: placed, overflow: fresh.length - placed.length }
  }

  let layout = wall.layout
  let slots = pad(wall.slots, capacity(layout))

  if (fresh.length === 1 && at !== undefined && at < slots.length) {
    slots = [...slots]
    slots[at] = fresh[0]
    return { wall: { layout, slots }, added: fresh, overflow: 0 }
  }

  const filled = slots.filter((s) => s !== null).length
  if (slots.length - filled < fresh.length) {
    layout = Math.max(layout, layoutFor(filled + fresh.length))
    slots = pad(slots, capacity(layout))
  }

  const start = at ?? 0
  const order = [...slots.keys()].map((k) => (k + start) % slots.length)
  const empty = order.filter((k) => slots[k] === null)
  slots = [...slots]
  const added: string[] = []
  fresh.forEach((id, n) => {
    if (n < empty.length) {
      slots[empty[n]] = id
      added.push(id)
    }
  })
  return { wall: { layout, slots }, added, overflow: fresh.length - added.length }
}

export function removeFromWall(wall: Wall, index: number): Wall {
  if (wall.layout === 'auto') return { ...wall, slots: wall.slots.filter((_, k) => k !== index) }
  const slots = [...wall.slots]
  slots[index] = null
  return { ...wall, slots }
}

/** Swaps two cells, so dragging a tile onto another trades their places. */
export function moveOnWall(wall: Wall, from: number, to: number): Wall {
  if (from === to || from < 0 || to < 0) return wall
  const size = wall.layout === 'auto' ? wall.slots.length : capacity(wall.layout)
  if (from >= size || to >= size) return wall
  const slots = pad(wall.slots, size)
  ;[slots[from], slots[to]] = [slots[to], slots[from]]
  return { ...wall, slots: wall.layout === 'auto' ? slots.filter((s) => s !== null) : slots }
}

/** Switches layout, keeping screens in order. Reports how many no longer fit. */
export function setWallLayout(wall: Wall, layout: 'auto' | number): { wall: Wall; dropped: number } {
  const screens = wall.slots.filter((s): s is string => s !== null)
  if (layout === 'auto') return { wall: { layout, slots: screens.slice(0, MAX_TILES) }, dropped: Math.max(0, screens.length - MAX_TILES) }
  const size = capacity(layout)
  // Keep positions when they still fit, so switching up and back loses nothing.
  if (wall.layout !== 'auto' && wall.slots.slice(size).every((s) => s === null)) {
    return { wall: { layout, slots: pad(wall.slots, size) }, dropped: 0 }
  }
  return { wall: { layout, slots: pad(screens, size) }, dropped: Math.max(0, screens.length - size) }
}
