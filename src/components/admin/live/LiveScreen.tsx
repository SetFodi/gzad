'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import {
  activeSources,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  findAnchor,
  itemSteps,
  locate,
  screenActivity,
  uploadGap,
  type Connection,
  type LiveProgram,
  type LiveSource,
  type PlayReport,
  type ProgramReason,
} from '@/lib/live-view'
import { useAdminText } from '@/lib/admin-i18n'

// One screen, drawn the way the LED draws it. Every frame is rendered onto a
// canvas at the screen's native resolution (240×80 on the current fleet), then
// CSS scales the canvas up with hard pixel edges, so what you see is what the
// LED can physically show, not a sharper copy of the source file. Captions sit
// above the picture, never on it. The picture only plays while the screen is
// connected and reporting; otherwise it stays dark, as the LED does.

/** Re-seek a video only when it has drifted further than this from the screen. */
const SEEK_TOLERANCE = 1.2
/** Start loading the next item this many seconds before it is due. */
const PRELOAD_AHEAD = 4
/** The pixel grid only reads as LED pixels once each one is this many CSS pixels wide. */
const GRID_MIN_SCALE = 3.5
/** Stills only change when the item does; repaint them a few times a second, not every frame. */
const STILL_FRAME_MS = 250

export type ScreenState =
  | 'loading' | 'offline' | 'no_program' | 'waiting' | 'reconnected' | 'silent' | 'unmatched' | 'live'

interface Props {
  program: LiveProgram | null
  reason?: ProgramReason
  loading: boolean
  reports: PlayReport[] | undefined
  /** Undefined until known, or when the Realtime Server can't be asked. */
  connection: Connection | undefined
  /** Add to Date.now() to get the server's clock. */
  clockOffset: number
  pixelGrid: boolean
  /** Called when the screen reports content this program doesn't contain. */
  onProgramChanged: () => void
  /** Left side of the caption: the screen's name and status. */
  title: ReactNode
  /** Right side of the caption: tile buttons. */
  actions: ReactNode
  /** Spread onto the caption, which doubles as the drag handle. */
  captionProps?: HTMLAttributes<HTMLDivElement>
  onEnlarge?: () => void
}

type Translate = (en: string, vars?: Record<string, string | number>) => string

function ago(ms: number, t: Translate): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return t('{n} s ago', { n: s })
  if (s < 3600) return t('{n} min ago', { n: Math.floor(s / 60) })
  if (s < 86400) return t('{n} h ago', { n: Math.floor(s / 3600) })
  return t('{n} days ago', { n: Math.floor(s / 86400) })
}

function placeholder(ctx: CanvasRenderingContext2D, source: LiveSource) {
  ctx.fillStyle = '#141414'
  ctx.fillRect(source.x, source.y, source.w, source.h)
  ctx.fillStyle = '#ffb000'
  ctx.font = `${Math.max(8, Math.floor(source.h * 0.3))}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(source.label, source.x + source.w / 2, source.y + source.h / 2, Math.max(1, source.w - 4))
}

export default function LiveScreen({
  program, reason, loading, reports, connection, clockOffset, pixelGrid, onProgramChanged, title, actions, captionProps, onEnlarge,
}: Props) {
  const { t } = useAdminText()
  const tileRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLSpanElement>(null)
  const [nowPlaying, setNowPlaying] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [now, setNow] = useState(() => Date.now())

  const width = program?.width ?? DEFAULT_WIDTH
  const height = program?.height ?? DEFAULT_HEIGHT

  const timing = useMemo(() => {
    if (!program || !reports) return null
    return { anchor: findAnchor(program, reports), steps: itemSteps(program, reports) }
  }, [program, reports])

  const latestReport = useMemo(() => (reports ?? []).reduce((max, r) => Math.max(max, r.beganAt), 0), [reports])
  const uploadMinutes = Math.max(1, Math.round(uploadGap(reports ?? []) / 60_000))

  const serverNow = now + clockOffset
  const activity = screenActivity(connection, reports ?? [], serverNow)

  let state: ScreenState
  if (activity.state === 'offline') state = 'offline'
  else if (!program) state = loading ? 'loading' : 'no_program'
  else if (!reports) state = 'loading'
  else if (reports.length === 0) state = 'waiting'
  else if (activity.state === 'connecting') state = 'reconnected'
  else if (activity.state === 'silent') state = 'silent'
  else if (!timing?.anchor) state = 'unmatched'
  else state = 'live'

  // The newest report isn't in the program we hold: maybe we hold an old one.
  // Keep asking while it lasts; the wall backs off so the screen isn't flooded.
  const recheck = state === 'unmatched' || (state === 'live' && timing?.anchor ? !timing.anchor.current : false)

  // The draw loop reads these through refs so new reports or a clock correction
  // don't restart it, which would pause and re-seek every video on the wall.
  const timingRef = useRef(timing)
  const liveRef = useRef(state === 'live')
  const offsetRef = useRef(clockOffset)
  const changedRef = useRef(onProgramChanged)
  const unavailableRef = useRef(t('Media unavailable'))
  useEffect(() => {
    timingRef.current = timing
    liveRef.current = state === 'live'
    offsetRef.current = clockOffset
    changedRef.current = onProgramChanged
    unavailableRef.current = t('Media unavailable')
  }, [timing, state, clockOffset, onProgramChanged, t])

  useEffect(() => {
    if (recheck) changedRef.current()
  }, [recheck, now])

  // Ticks the "reported N min ago" text and the stale check.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const tile = tileRef.current
    if (!tile) return
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width))
    observer.observe(tile)
    return () => observer.disconnect()
  }, [width])

  useEffect(() => {
    const canvas = canvasRef.current
    const host = hostRef.current
    const ctx = canvas?.getContext('2d')
    if (!program || !canvas || !host || !ctx) return

    // Downscale the way a controller's scaler does, smoothly; CSS then enlarges
    // the result with hard edges.
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    const media = new Map<string, HTMLImageElement | HTMLVideoElement>()
    const starting = new WeakSet<HTMLVideoElement>()
    let active = new Set<HTMLVideoElement>()
    let lastIndex = -1
    let lastPaint = 0
    let frame = 0

    const element = (source: LiveSource) => {
      const key = `${source.kind}:${source.url}`
      let el = media.get(key)
      if (!el) {
        if (source.kind === 'video') {
          const video = document.createElement('video')
          video.muted = true
          video.playsInline = true
          video.loop = true
          video.preload = 'auto'
          video.src = source.url!
          // Kept in the document: some browsers stop decoding detached videos.
          host.appendChild(video)
          el = video
        } else {
          const image = new Image()
          image.decoding = 'async'
          image.src = source.url!
          el = image
        }
        media.set(key, el)
      }
      return el
    }

    const paint = (source: LiveSource, offset: number, playing: Set<HTMLVideoElement>) => {
      if (source.kind === 'other' || !source.url) {
        placeholder(ctx, source)
        return
      }
      const el = element(source)
      // A file that failed (missing, blocked, undecodable) must not pass for a dark ad.
      const failed = el instanceof HTMLImageElement ? el.complete && el.naturalWidth === 0 : el.error !== null
      if (failed) {
        placeholder(ctx, { ...source, label: unavailableRef.current })
        return
      }
      if (el instanceof HTMLImageElement) {
        if (el.complete) ctx.drawImage(el, source.x, source.y, source.w, source.h)
        return
      }

      playing.add(el)
      // Some files don't declare a duration up front; fall back to what is seekable.
      const length = Number.isFinite(el.duration) && el.duration > 0
        ? el.duration
        : el.seekable.length > 0 ? el.seekable.end(el.seekable.length - 1) : 0
      const target = length ? offset % length : offset
      if (el.readyState >= HTMLMediaElement.HAVE_METADATA && !el.seeking) {
        let drift = Math.abs(el.currentTime - target)
        if (length) drift = Math.min(drift, length - drift) // across the loop point
        if (!active.has(el) || drift > SEEK_TOLERANCE) el.currentTime = target
      }
      if (el.paused && !starting.has(el)) {
        starting.add(el)
        el.play().catch(() => {}).finally(() => starting.delete(el))
      }
      if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) ctx.drawImage(el, source.x, source.y, source.w, source.h)
    }

    const draw = () => {
      frame = requestAnimationFrame(draw)

      // Offline or silent: the LED is dark, so the replica is too.
      const current = liveRef.current ? timingRef.current : null
      const pos = current?.anchor ? locate(current.steps, current.anchor, Date.now() + offsetRef.current) : null
      const item = pos ? program.items[pos.index] : undefined
      const index = pos && item ? pos.index : -1

      // Video needs every frame; stills only need repainting when something changes.
      const stamp = performance.now()
      if (active.size === 0 && index === lastIndex && stamp - lastPaint < STILL_FRAME_MS) return
      lastPaint = stamp

      ctx.fillStyle = '#000' // an unlit LED
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const playing = new Set<HTMLVideoElement>()
      if (pos && item) {
        for (const { source, offset } of activeSources(item, pos.offset)) paint(source, offset, playing)

        if (pos.seconds - pos.offset < PRELOAD_AHEAD) {
          for (const layer of program.items[(pos.index + 1) % program.items.length].layers) {
            for (const source of layer) if (source.url && source.kind !== 'other') element(source)
          }
        }
        if (progressRef.current) {
          progressRef.current.style.transform = `scaleX(${Math.min(1, pos.offset / Math.max(pos.seconds, 0.001))})`
        }
      } else if (progressRef.current) {
        progressRef.current.style.transform = 'scaleX(0)'
      }
      if (index !== lastIndex) setNowPlaying(item ? item.name : null)
      lastIndex = index

      for (const video of active) if (!playing.has(video)) video.pause()
      active = playing
    }

    const onVisibility = () => {
      if (!document.hidden) return
      for (const video of active) video.pause()
      active = new Set()
    }

    document.addEventListener('visibilitychange', onVisibility)
    draw()

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const el of media.values()) {
        if (el instanceof HTMLVideoElement) {
          el.pause()
          el.removeAttribute('src')
          el.load()
          el.remove()
        }
      }
    }
  }, [program])

  const reasonText: Record<ProgramReason, string> = {
    not_connected: t('The screen isn’t connected and its group has no live campaigns.'),
    no_answer: t('The screen didn’t answer and its group has no live campaigns.'),
    unreadable: t('The screen’s program couldn’t be read.'),
    unreachable: t('The Realtime Server can’t be reached.'),
  }

  const since = activity.since
  const message: { title: string; detail?: string } | null =
    state === 'loading' ? { title: t('Reading the screen’s program…') }
      : state === 'offline' ? { title: t('Offline'), detail: since ? t('Last seen {when}', { when: ago(serverNow - since, t) }) : undefined }
        : state === 'no_program' ? { title: t('Nothing to show'), detail: reason ? reasonText[reason] : undefined }
          : state === 'waiting' ? { title: t('Waiting for play reports'), detail: t('This screen uploads what it played every {n} min.', { n: uploadMinutes }) }
            : state === 'reconnected' ? { title: t('Back online — waiting for play reports'), detail: t('Its first upload since reconnecting is due within {n} min.', { n: uploadMinutes }) }
              : state === 'silent' ? { title: t('Not playing'), detail: since ? t('No play reports for {n} min.', { n: Math.max(1, Math.round((serverNow - since) / 60_000)) }) : undefined }
                : state === 'unmatched' ? { title: t('Its play reports don’t match its current program yet'), detail: t('Normal right after new ads are pushed: reports catch up within about 5 minutes.') }
                  : null

  return (
    <div className="live-frame" data-state={state} style={{ '--aspect': width / height } as CSSProperties}>
      <div className="live-caption" {...captionProps}>
        <span className="live-caption-title">{title}</span>
        <span className="live-caption-meta">
          {state === 'live' && nowPlaying && <span className="live-now">{nowPlaying}</span>}
          <span className="live-res">{width}×{height}</span>
          {latestReport > 0 && (
            <span className="live-age" title={t('Newest play report from this screen')}>
              {t('Reported {when}', { when: ago(now + clockOffset - latestReport, t) })}
            </span>
          )}
          {/* State pills last: when space runs out, text on the left is clipped first. */}
          {program?.source === 'expected' && (
            <span className="live-pill live-pill-warn" title={t('Couldn’t read the program from the screen, so this shows the playlist its group should be playing.')}>
              {t('Expected playlist')}
            </span>
          )}
          {state === 'live' && (
            <span className="live-pill live-pill-live" title={t('Rebuilt from play reports and positioned in real time.')}>{t('Live')}</span>
          )}
          {state === 'offline' && <span className="live-pill live-pill-off">{t('Offline')}</span>}
          {state === 'silent' && (
            <span className="live-pill live-pill-warn" title={t('Connected, but its play reports stopped arriving, so it isn’t playing anything.')}>
              {t('Not playing')}
            </span>
          )}
        </span>
        {actions}
        <span className="live-progress" aria-hidden><span ref={progressRef} /></span>
      </div>

      <div
        ref={tileRef}
        className="live-tile"
        style={{ '--led-w': width, '--led-h': height, aspectRatio: `${width} / ${height}` } as CSSProperties}
        onDoubleClick={onEnlarge}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="live-canvas"
          role="img"
          aria-label={nowPlaying ? t('Showing {name}', { name: nowPlaying }) : t('Screen')}
        />
        {pixelGrid && scale >= GRID_MIN_SCALE && <span className="live-led-grid" aria-hidden />}
        {message && (
          <div className="live-screen-message" role="status">
            <strong>{message.title}</strong>
            {message.detail && <span>{message.detail}</span>}
          </div>
        )}
        <div ref={hostRef} className="live-media-host" aria-hidden />
      </div>
    </div>
  )
}
