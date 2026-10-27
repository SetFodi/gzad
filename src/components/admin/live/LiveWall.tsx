'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import { Check, Expand, FolderOpen, Maximize2, Minimize2, Plus, Search, Shrink, Trash2, X } from 'lucide-react'
import LiveScreen from './LiveScreen'
import type { Catalog, CatalogDevice, LiveDataSource } from './data-source'
import {
  autoGrid,
  EMPTY_WALL,
  MAX_TILES,
  moveOnWall,
  placeOnWall,
  removeFromWall,
  setWallLayout,
  WALL_LAYOUTS,
  type Connection,
  type LiveProgram,
  type NowPlaying,
  type PlayReport,
  type ProgramReason,
  type Wall,
} from '@/lib/live-view'
import { useAdminText } from '@/lib/admin-i18n'

/** The list's online dots; tiles get their own, fresher status with the feed. */
const CATALOG_EVERY = 30_000
/**
 * Reports, connection status and what each screen on the wall says it's
 * playing. The switch times it brings are exact to about a second; in between,
 * tiles run the loop on their own, so this only bounds how soon a surprise
 * (a skipped ad, a screen going dark) shows.
 */
const FEED_EVERY = 10_000
/** Re-read a screen's program this often even when nothing looks wrong. */
const PROGRAM_EVERY = 10 * 60_000
/** Don't ask a screen for its program more often than this. */
const PROGRAM_RETRY = 60_000
/** The fleet's screens are 240×80; each tile letterboxes its own aspect in its cell. */
const TILE_ASPECT = 3
const UNGROUPED = '__ungrouped__'

const DRAG_DEVICE = 'application/x-gzad-device'
const DRAG_GROUP = 'application/x-gzad-group'
const DRAG_TILE = 'application/x-gzad-tile'

interface ProgramState {
  program: LiveProgram | null
  reason?: ProgramReason
  loading: boolean
  fetchedAt: number
}

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, '')

/**
 * A refresh that returns the same program must keep the old object: a new one
 * restarts the tile's player, which blanks the screen and reloads its media.
 */
function sameProgram(a: LiveProgram | null | undefined, b: LiveProgram | null): boolean {
  return !!a && !!b && JSON.stringify(a) === JSON.stringify(b)
}

export default function LiveWall({ source }: { source: LiveDataSource }) {
  const { t } = useAdminText()
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogError, setCatalogError] = useState(false)
  const [wall, setWall] = useState<Wall>(EMPTY_WALL)
  const [programs, setPrograms] = useState<Record<string, ProgramState>>({})
  const [reports, setReports] = useState<Record<string, PlayReport[]>>({})
  const [connections, setConnections] = useState<Record<string, Connection | undefined>>({})
  const [playing, setPlaying] = useState<Record<string, NowPlaying | undefined>>({})
  const [clockOffset, setClockOffset] = useState(0)
  const [maximized, setMaximized] = useState<string | null>(null)
  const [tab, setTab] = useState<'screens' | 'groups'>('screens')
  const [query, setQuery] = useState('')
  const [pixelGrid, setPixelGrid] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<number | 'wall' | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [area, setArea] = useState({ width: 0, height: 0 })
  const wallRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const programsRef = useRef(programs)
  const watchedRef = useRef<string[]>([])
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Re-checks asked for per screen since its program last changed, for backoff. */
  const rechecks = useRef(new Map<string, number>())
  const feedSent = useRef(0)
  const feedApplied = useRef(0)

  const watched = useMemo(() => [...new Set(wall.slots.filter((s): s is string => s !== null))], [wall.slots])
  useEffect(() => {
    programsRef.current = programs
    watchedRef.current = watched
  }, [programs, watched])

  const devices = useMemo(() => new Map((catalog?.devices ?? []).map((d) => [d.id, d])), [catalog])
  const groupNames = useMemo(() => new Map((catalog?.groups ?? []).map((g) => [g.id, g.name])), [catalog])

  // ─── Data ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = () => source.catalog().then(
      (next) => { setCatalog(next); setCatalogError(false) },
      () => setCatalogError(true),
    )
    load()
    const id = setInterval(load, CATALOG_EVERY)
    return () => clearInterval(id)
  }, [source])

  const fetchProgram = useCallback(async (id: string) => {
    setPrograms((prev) => ({ ...prev, [id]: { program: prev[id]?.program ?? null, reason: prev[id]?.reason, loading: true, fetchedAt: Date.now() } }))
    try {
      const result = await source.program(id)
      const unchanged = sameProgram(programsRef.current[id]?.program, result.program)
      if (!unchanged) rechecks.current.delete(id)
      setPrograms((prev) => ({
        ...prev,
        [id]: {
          program: unchanged ? prev[id]?.program ?? result.program : result.program,
          reason: result.reason,
          loading: false,
          fetchedAt: Date.now(),
        },
      }))
    } catch {
      setPrograms((prev) => ({ ...prev, [id]: { program: prev[id]?.program ?? null, reason: 'unreachable', loading: false, fetchedAt: Date.now() } }))
    }
  }, [source])

  const refreshFeed = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    const sent = ++feedSent.current
    const started = Date.now()
    try {
      const feed = await source.feed(ids)
      // A slower, older response must not overwrite newer reports.
      if (sent < feedApplied.current) return
      feedApplied.current = sent
      setClockOffset(feed.serverTime - (started + Date.now()) / 2)
      setReports((prev) => ({ ...prev, ...feed.reports }))
      setConnections((prev) => {
        const next = { ...prev }
        for (const id of ids) next[id] = feed.connections?.[id]
        return next
      })
      setPlaying((prev) => {
        const next = { ...prev }
        for (const id of ids) next[id] = feed.playing?.[id]
        return next
      })
    } catch {
      // Keep the last reports and status: tiles go dark by themselves once the
      // reports they hold run out.
    }
  }, [source])

  const hasScreens = watched.length > 0
  useEffect(() => {
    if (!hasScreens) return
    const feed = setInterval(() => refreshFeed(watchedRef.current), FEED_EVERY)
    const stale = setInterval(() => {
      for (const id of watchedRef.current) {
        const state = programsRef.current[id]
        if (state && !state.loading && Date.now() - state.fetchedAt > PROGRAM_EVERY) fetchProgram(id)
      }
    }, 60_000)
    return () => {
      clearInterval(feed)
      clearInterval(stale)
    }
  }, [hasScreens, refreshFeed, fetchProgram])

  // The screen reported content the program we hold doesn't have. Re-read it,
  // backing off (1, 2, 4, 8 min, then the regular refresh) while that persists:
  // right after a push the reports simply lag the new program.
  const programChanged = useCallback((id: string) => {
    const state = programsRef.current[id]
    if (!state || state.loading) return
    const tries = rechecks.current.get(id) ?? 0
    if (Date.now() - state.fetchedAt < Math.min(PROGRAM_RETRY * 2 ** tries, PROGRAM_EVERY)) return
    rechecks.current.set(id, tries + 1)
    fetchProgram(id)
  }, [fetchProgram])

  // ─── Layout ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const observer = new ResizeObserver(([entry]) => {
      setArea({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMaximized(null) }
    const onFullscreen = () => setFullscreen(document.fullscreenElement === wallRef.current)
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFullscreen)
    }
  }, [])

  const flash = (text: string) => {
    setNotice(text)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(null), 4000)
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  const groupScreens = (groupId: string) =>
    (catalog?.devices ?? [])
      .filter((d) => (groupId === UNGROUPED ? !d.groupId : d.groupId === groupId))
      .map((d) => d.id)

  const addScreens = (ids: string[], at?: number) => {
    const result = placeOnWall(wall, ids, at)
    setWall(result.wall)
    for (const id of result.added) if (!programsRef.current[id]) fetchProgram(id)
    if (result.added.length > 0) {
      refreshFeed(result.wall.slots.filter((s): s is string => s !== null))
    }
    if (result.overflow > 0) flash(t('{n} screens didn’t fit — the wall holds {max}.', { n: result.overflow, max: MAX_TILES }))
    else if (result.added.length === 0) flash(t('Already on the wall'))
  }

  const chooseLayout = (layout: 'auto' | number) => {
    const result = setWallLayout(wall, layout)
    setWall(result.wall)
    setMaximized(null)
    if (result.dropped > 0) flash(t('{n} screens didn’t fit — the wall holds {max}.', { n: result.dropped, max: result.wall.slots.length }))
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else wallRef.current?.requestFullscreen().catch(() => {})
  }

  const accepts = (e: DragEvent) =>
    [DRAG_DEVICE, DRAG_GROUP, DRAG_TILE].some((type) => e.dataTransfer.types.includes(type))

  const onDragOver = (target: number | 'wall') => (e: DragEvent) => {
    if (maximized || !accepts(e)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(DRAG_TILE) ? 'move' : 'copy'
    setDropTarget(target)
  }

  const onDrop = (target: number | 'wall') => (e: DragEvent) => {
    if (maximized || !accepts(e)) return
    e.preventDefault()
    e.stopPropagation()
    setDropTarget(null)
    const at = target === 'wall' ? undefined : target
    const tile = e.dataTransfer.getData(DRAG_TILE)
    const device = e.dataTransfer.getData(DRAG_DEVICE)
    const group = e.dataTransfer.getData(DRAG_GROUP)
    if (tile !== '') {
      if (at !== undefined) setWall((w) => moveOnWall(w, Number(tile), at))
    } else if (device) {
      addScreens([device], at)
    } else if (group) {
      addScreens(groupScreens(group), at)
    }
  }

  // ─── Panel ─────────────────────────────────────────────────────────────────

  const q = normalize(query)
  const matchesQuery = (d: CatalogDevice) =>
    !q || [d.name, d.id, d.plate, d.groupId ? groupNames.get(d.groupId) : null]
      .some((v) => v && normalize(v).includes(q))

  const listedDevices = (catalog?.devices ?? []).filter(matchesQuery)
  const groups = [
    ...(catalog?.groups ?? []).map((g) => ({ id: g.id, name: g.name })),
    ...((catalog?.devices ?? []).some((d) => !d.groupId) ? [{ id: UNGROUPED, name: t('No group') }] : []),
  ].filter((g) => !q || normalize(g.name).includes(q))

  // ─── Grid ──────────────────────────────────────────────────────────────────

  const cells: (string | null)[] = maximized ? [maximized] : wall.slots
  const grid = maximized
    ? { cols: 1, rows: 1 }
    : wall.layout === 'auto'
      ? autoGrid(Math.max(1, wall.slots.length), area.width, area.height, TILE_ASPECT)
      : WALL_LAYOUTS[wall.layout]

  const renderTile = (id: string, index: number) => {
    const device = devices.get(id)
    const state = programs[id]
    const online = connections[id]?.online ?? device?.online
    return (
      <LiveScreen
        program={state?.program ?? null}
        reason={state?.reason}
        loading={!state || state.loading}
        reports={reports[id]}
        connection={connections[id]}
        playing={playing[id]}
        clockOffset={clockOffset}
        pixelGrid={pixelGrid}
        onProgramChanged={() => programChanged(id)}
        onEnlarge={() => setMaximized(maximized ? null : id)}
        captionProps={{
          draggable: !maximized,
          onDragStart: (e) => {
            e.dataTransfer.setData(DRAG_TILE, String(index))
            e.dataTransfer.effectAllowed = 'move'
          },
          title: maximized ? undefined : t('Drag to move · double-click the screen to enlarge'),
        }}
        title={
          <>
            <span className="live-dot" data-online={online || undefined} aria-hidden />
            <span className="live-name">{device?.name || id}</span>
            {device?.plate && <span className="plate live-plate">{device.plate}</span>}
          </>
        }
        actions={
          <span className="live-tile-actions">
            <button
              type="button"
              onClick={() => setMaximized(maximized ? null : id)}
              aria-label={maximized ? t('Back to the wall') : t('Enlarge')}
              title={maximized ? t('Back to the wall') : t('Enlarge')}
            >
              {maximized ? <Minimize2 size={13} aria-hidden /> : <Maximize2 size={13} aria-hidden />}
            </button>
            {!maximized && (
              <button
                type="button"
                onClick={() => setWall((w) => removeFromWall(w, index))}
                aria-label={t('Remove from wall')}
                title={t('Remove from wall')}
              >
                <X size={13} aria-hidden />
              </button>
            )}
          </span>
        }
      />
    )
  }

  return (
    <div className="portal-page live-view">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{t('Live view')}</h1>
          <p className="portal-subtitle">{t('What each screen is showing right now, at the LED’s own resolution.')}</p>
        </div>
        <div className="live-toolbar">
          <div className="live-layouts" role="group" aria-label={t('Layout')}>
            <button
              type="button"
              aria-pressed={wall.layout === 'auto'}
              onClick={() => chooseLayout('auto')}
              title={t('Fit the grid to the screens on the wall')}
            >
              {t('Auto')}
            </button>
            {WALL_LAYOUTS.map((l, i) => (
              <button
                key={`${l.cols}x${l.rows}`}
                type="button"
                aria-pressed={wall.layout === i}
                onClick={() => chooseLayout(i)}
                title={t('{cols} × {rows} grid', { cols: l.cols, rows: l.rows })}
              >
                {l.cols}×{l.rows}
              </button>
            ))}
          </div>
          <label className="live-toggle" title={t('Draw the LED’s pixel grid on large tiles')}>
            <input type="checkbox" checked={pixelGrid} onChange={(e) => setPixelGrid(e.target.checked)} />
            {t('LED pixels')}
          </label>
          <button
            type="button"
            className="portal-btn-secondary"
            onClick={() => { setWall({ layout: wall.layout, slots: wall.layout === 'auto' ? [] : wall.slots.map(() => null) }); setMaximized(null) }}
            disabled={!hasScreens}
          >
            <Trash2 size={15} aria-hidden /> {t('Clear wall')}
          </button>
          <button type="button" className="portal-btn-secondary" onClick={toggleFullscreen}>
            {fullscreen ? <Shrink size={15} aria-hidden /> : <Expand size={15} aria-hidden />}
            {fullscreen ? t('Exit fullscreen') : t('Fullscreen')}
          </button>
        </div>
      </div>

      {catalogError && (
        <div className="portal-alert portal-alert-danger" role="alert">
          {t('Couldn’t load the screen list.')}
        </div>
      )}
      {catalog?.realtimeError && (
        <div className="portal-alert portal-alert-warning">
          <strong>{t('Live status unavailable')}</strong>. {t('Online dots may be out of date; playback still follows the play reports.')}
        </div>
      )}

      <div className="live-body">
        <aside className="live-panel" aria-label={t('Screens')}>
          <div className="live-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'screens'} onClick={() => setTab('screens')}>
              {t('Screens')} <span>{catalog?.devices.length ?? 0}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === 'groups'} onClick={() => setTab('groups')}>
              {t('Groups')} <span>{catalog?.groups.length ?? 0}</span>
            </button>
          </div>
          <label className="live-search">
            <Search size={15} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Search name, ID, plate or group')}
              aria-label={t('Search name, ID, plate or group')}
            />
          </label>

          <ul className="live-list">
            {!catalog && !catalogError && <li className="live-list-empty">{t('Loading…')}</li>}
            {tab === 'screens' && catalog && listedDevices.length === 0 && (
              <li className="live-list-empty">{t('No screens match')}</li>
            )}
            {tab === 'screens' && listedDevices.map((d) => {
              const onWall = watched.includes(d.id)
              const group = d.groupId ? groupNames.get(d.groupId) : null
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    className="live-item"
                    draggable={!onWall}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_DEVICE, d.id)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => addScreens([d.id])}
                    disabled={onWall}
                    title={onWall ? t('On the wall') : t('Add to wall')}
                  >
                    <span className="live-dot" data-online={d.online || undefined} aria-hidden />
                    <span className="live-item-text">
                      <span className="live-item-name">{d.name || d.id}</span>
                      <span className="live-item-sub">{[d.name && d.name !== d.id ? d.id : null, group].filter(Boolean).join(' · ') || t('No group')}</span>
                    </span>
                    {d.plate && <span className="plate live-plate">{d.plate}</span>}
                    {onWall ? <Check size={15} aria-label={t('On the wall')} /> : <Plus size={15} aria-hidden />}
                  </button>
                </li>
              )
            })}

            {tab === 'groups' && catalog && groups.length === 0 && (
              <li className="live-list-empty">{t('No groups yet')}</li>
            )}
            {tab === 'groups' && groups.map((g) => {
              const ids = groupScreens(g.id)
              const online = ids.filter((id) => devices.get(id)?.online).length
              const allOn = ids.length > 0 && ids.every((id) => watched.includes(id))
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    className="live-item"
                    draggable={ids.length > 0}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_GROUP, g.id)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => addScreens(ids)}
                    disabled={ids.length === 0 || allOn}
                    title={allOn ? t('On the wall') : t('Add group to wall')}
                  >
                    <FolderOpen size={16} aria-hidden className="live-item-icon" />
                    <span className="live-item-text">
                      <span className="live-item-name">{g.name}</span>
                      <span className="live-item-sub">{t('{n} screens · {online} online', { n: ids.length, online })}</span>
                    </span>
                    {allOn ? <Check size={15} aria-label={t('On the wall')} /> : <Plus size={15} aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <section
          ref={wallRef}
          className="live-wall"
          data-fullscreen={fullscreen || undefined}
          aria-label={t('Live view')}
          onDragOver={onDragOver('wall')}
          onDragLeave={() => setDropTarget(null)}
          onDrop={onDrop('wall')}
          data-drop={dropTarget === 'wall' || undefined}
        >
          <div
            ref={gridRef}
            className="live-grid"
            style={{
              gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
              '--aspect': TILE_ASPECT,
            } as CSSProperties}
          >
            {cells.map((id, index) => (
              <div
                key={id ?? `empty-${index}`}
                className="live-cell"
                data-empty={!id || undefined}
                data-drop={dropTarget === index || undefined}
                onDragOver={onDragOver(index)}
                onDrop={onDrop(index)}
              >
                {id ? renderTile(id, maximized ? wall.slots.indexOf(id) : index) : (
                  <span className="live-cell-empty">{t('Drop a screen here')}</span>
                )}
              </div>
            ))}
          </div>

          {cells.length === 0 && (
            <div className="live-wall-empty">
              <strong>{t('Add screens from the list, or drag a whole group here.')}</strong>
              <span>{t('Double-click a screen to enlarge it. Esc goes back.')}</span>
            </div>
          )}

          {notice && <div className="live-notice" role="status">{notice}</div>}
        </section>
      </div>
    </div>
  )
}
