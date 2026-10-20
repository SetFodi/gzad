'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import HourRange from '@/components/app/HourRange'
import { BarChart3, Play, Clock, Monitor, Megaphone, X, MapPin, ChevronDown } from 'lucide-react'
import { useTranslations } from '@/lib/i18n'

const StatsMapView = dynamic(() => import('@/components/admin/StatsMapView'), { ssr: false })

interface PlayLog {
  campaign_id: string | null
  program_name: string
  device_id: string
  began_at: string
  duration_seconds: number
  lat: number
  lng: number
}

interface DailyTrend {
  date: string
  plays: number
  duration: number
}

const TZ = 'Asia/Tbilisi'
function toTbilisiDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
}
function toTbilisiHour(iso: string): number {
  return parseInt(new Date(iso).toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }), 10)
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ─── Dropdown select ─────────────────────────────────────────────────────────
function FilterSelect({ label, value, options, onChange }: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div style={{ position: 'relative', minWidth: 150 }}>
      <span style={{ fontSize: 11, color: 'var(--portal-muted)', display: 'block', marginBottom: 4 }}>{label}</span>
      <div style={{ position: 'relative' }}>
        <select
          aria-label={label}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', padding: '6px 28px 6px 10px', fontSize: 13,
            background: 'var(--portal-surface)', color: 'var(--portal-text)',
            border: '1px solid var(--portal-border)', borderRadius: 8,
            appearance: 'none', cursor: 'pointer', outline: 'none',
          }}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none', color: 'var(--portal-muted)',
        }} />
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function FleetStatsPage() {
  const { t } = useTranslations()
  const ft = t.fleet.stats
  const common = t.fleet.common

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [myDeviceIds, setMyDeviceIds] = useState<string[]>([])
  const [allLogs, setAllLogs] = useState<PlayLog[]>([])
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([])
  const chart = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<'campaigns' | 'devices' | 'daily' | 'map'>('campaigns')

  // Date range selection
  const [selStart, setSelStart] = useState<number | null>(null)
  const [selEnd, setSelEnd] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<number | null>(null)
  const dragMoved = useRef(false)
  const selectionAnchor = useRef<number | null>(null)

  // Map filters
  const [mapCampaign, setMapCampaign] = useState('all')
  const [mapDevice, setMapDevice] = useState('all')
  const [hourRange, setHourRange] = useState<[number, number]>([0, 23])

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setLoadError(false)
      try {
        const response = await fetch('/api/fleet/stats?detail=1', { signal: controller.signal })
        if (!response.ok) throw new Error('Fleet statistics unavailable')
        const data = await response.json()
        if (!Array.isArray(data.vehicles) || !Array.isArray(data.logs)) throw new Error('Invalid fleet statistics')

        const deviceIds: string[] = data.vehicles.map((vehicle: { device_id: string | null }) => vehicle.device_id).filter(Boolean)
        const fetched: PlayLog[] = data.logs.map((log: PlayLog) => ({
          ...log,
          program_name: log.program_name || 'unknown',
          lat: Number(log.lat) || 0,
          lng: Number(log.lng) || 0,
        }))
        const dailyMap = new Map<string, { plays: number; duration: number }>()
        for (const log of fetched) {
          const date = toTbilisiDate(log.began_at)
          const day = dailyMap.get(date) || { plays: 0, duration: 0 }
          day.plays++
          day.duration += log.duration_seconds || 0
          dailyMap.set(date, day)
        }
        const trend: DailyTrend[] = []
        const date = new Date()
        date.setDate(date.getDate() - 30)
        const today = new Date()
        while (date <= today) {
          const key = toTbilisiDate(date.toISOString())
          trend.push({ date: key, plays: dailyMap.get(key)?.plays || 0, duration: dailyMap.get(key)?.duration || 0 })
          date.setDate(date.getDate() + 1)
        }
        if (!controller.signal.aborted) {
          setMyDeviceIds(deviceIds)
          setAllLogs(fetched)
          setDailyTrend(trend)
        }
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [attempt])

  useEffect(() => {
    if (chart.current) chart.current.scrollLeft = chart.current.scrollWidth
  }, [dailyTrend])

  // Filter logs by selected date range
  const filteredLogs = useCallback(() => {
    if (selStart === null || selEnd === null) return allLogs
    const startDate = dailyTrend[Math.min(selStart, selEnd)]?.date
    const endDate = dailyTrend[Math.max(selStart, selEnd)]?.date
    if (!startDate || !endDate) return allLogs
    return allLogs.filter(l => {
      const d = toTbilisiDate(l.began_at)
      return d >= startDate && d <= endDate
    })
  }, [allLogs, selStart, selEnd, dailyTrend])

  const logs = filteredLogs()
  const hasSelection = selStart !== null && selEnd !== null
  const selLabel = hasSelection
    ? dailyTrend[Math.min(selStart!, selEnd!)]?.date === dailyTrend[Math.max(selStart!, selEnd!)]?.date
      ? dailyTrend[selStart!]?.date
      : `${dailyTrend[Math.min(selStart!, selEnd!)]?.date} — ${dailyTrend[Math.max(selStart!, selEnd!)]?.date}`
    : null

  // Map points with filters
  const mapPoints = useMemo(() => {
    return logs.filter(l => {
      if (!l.lat || !l.lng) return false
      if (mapCampaign !== 'all' && l.program_name.toLowerCase() !== mapCampaign) return false
      if (mapDevice !== 'all' && l.device_id !== mapDevice) return false
      const hour = toTbilisiHour(l.began_at)
      if (hour < hourRange[0] || hour > hourRange[1]) return false
      return true
    })
  }, [logs, mapCampaign, mapDevice, hourRange])

  const campaignOptions = useMemo(() => {
    const names = new Set<string>()
    for (const l of logs) {
      if (l.program_name && l.program_name !== 'unknown') names.add(l.program_name)
    }
    return [
      { value: 'all', label: ft.allCampaigns },
      ...Array.from(names).sort().map(n => ({ value: n.toLowerCase(), label: n })),
    ]
  }, [logs, ft])

  const deviceOptions = useMemo(() => [
    { value: 'all', label: ft.allDevices },
    ...myDeviceIds.map(id => ({ value: id, label: id })),
  ], [myDeviceIds, ft])

  // Compute stats from filtered logs
  const totalPlays = logs.length
  const totalDuration = logs.reduce((s, l) => s + (l.duration_seconds || 0), 0)

  const campaignPlays: Record<string, { plays: number; duration: number; devices: Set<string> }> = {}
  const devicePlays: Record<string, { plays: number; duration: number; campaigns: Set<string> }> = {}
  for (const l of logs) {
    const key = l.program_name?.toLowerCase()
    if (key && key !== 'unknown') {
      if (!campaignPlays[key]) campaignPlays[key] = { plays: 0, duration: 0, devices: new Set() }
      campaignPlays[key].plays++
      campaignPlays[key].duration += l.duration_seconds || 0
      campaignPlays[key].devices.add(l.device_id)
    }
    if (!devicePlays[l.device_id]) devicePlays[l.device_id] = { plays: 0, duration: 0, campaigns: new Set() }
    devicePlays[l.device_id].plays++
    devicePlays[l.device_id].duration += l.duration_seconds || 0
    if (key && key !== 'unknown') devicePlays[l.device_id].campaigns.add(key)
  }

  const campaignNames = Object.keys(campaignPlays).sort((a, b) => campaignPlays[b].plays - campaignPlays[a].plays)

  // Click/tap a first and last day, or drag with a mouse.
  const handleBarMouseDown = (index: number) => {
    dragStart.current = index
    setDragging(true)
    dragMoved.current = false
  }
  const handleBarMouseEnter = (index: number) => {
    if (dragging && dragStart.current !== null) {
      dragMoved.current = index !== dragStart.current
      selectionAnchor.current = null
      setSelStart(dragStart.current)
      setSelEnd(index)
    }
  }
  const handleBarMouseUp = () => {
    setDragging(false)
    dragStart.current = null
  }
  const handleBarClick = (index: number, event: React.MouseEvent<HTMLButtonElement>) => {
    if (dragMoved.current && event.detail > 0) return
    if ((event.shiftKey && selStart !== null) || selectionAnchor.current !== null) {
      setSelStart(selectionAnchor.current ?? selStart)
      setSelEnd(index)
      selectionAnchor.current = null
    } else {
      setSelStart(index)
      setSelEnd(index)
      selectionAnchor.current = index
    }
  }
  const clearSelection = () => {
    selectionAnchor.current = null
    dragMoved.current = false
    setSelStart(null)
    setSelEnd(null)
    setDragging(false)
    dragStart.current = null
  }

  if (loading) return <div className="portal-loading">{common.loading}</div>

  if (loadError) return (
    <div className="portal-page">
      <h1 className="portal-page-title">{ft.title}</h1>
      <div className="portal-alert portal-alert-danger" role="alert">{common.loadFailed}</div>
      <button type="button" className="portal-btn-secondary" onClick={() => setAttempt(value => value + 1)}>{common.retry}</button>
    </div>
  )

  if (myDeviceIds.length === 0) {
    return (
      <div className="portal-page">
        <h1 className="portal-page-title">{ft.title}</h1>
        <div className="portal-empty">
          <Monitor size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <p>{ft.noDevices}</p>
        </div>
      </div>
    )
  }

  const maxDailyPlays = Math.max(...dailyTrend.map(d => d.plays), 1)
  const selMin = hasSelection ? Math.min(selStart!, selEnd!) : -1
  const selMax = hasSelection ? Math.max(selStart!, selEnd!) : -1

  return (
    <div className="portal-page" onMouseUp={handleBarMouseUp}>
      <h1 className="portal-page-title">{ft.title}</h1>

      {/* Overview Cards */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--portal-info-soft)' }}>
            <Play size={24} color="var(--portal-info)" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{totalPlays.toLocaleString()}</span>
            <span className="stat-card-label">{ft.totalPlays}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--portal-success-soft)' }}>
            <Clock size={24} color="var(--portal-success)" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{formatDuration(totalDuration)}</span>
            <span className="stat-card-label">{ft.totalScreenTime}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--portal-warning-soft)' }}>
            <Monitor size={24} color="var(--portal-warning)" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{myDeviceIds.length}</span>
            <span className="stat-card-label">{ft.yourDevices}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--portal-fill)' }}>
            <Megaphone size={24} color="var(--portal-brass)" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{campaignNames.length}</span>
            <span className="stat-card-label">{ft.campaignsShown}</span>
          </div>
        </div>
      </div>

      {/* Selectable Daily Chart */}
      <div className="portal-section" style={{ marginBottom: '2rem' }}>
        <div className="section-head">
          <h2>{ft.last30Days}</h2>
          {hasSelection ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--portal-text-soft)', fontWeight: 500 }}>{selLabel}</span>
              <button type="button" onClick={clearSelection} className="action-btn">
                <X size={12} aria-hidden /> {ft.clear}
              </button>
            </div>
          ) : <span className="field-hint">{ft.selectHint}</span>}
        </div>
        <div
          ref={chart}
          className="play-chart"
          role="group"
          aria-label={ft.selectHint}
          onMouseLeave={() => { if (dragging) handleBarMouseUp() }}
        >
          {dailyTrend.map((d, i) => {
            const isSelected = hasSelection && i >= selMin && i <= selMax
            const isInactive = hasSelection && !isSelected
            return (
              <button
                key={d.date}
                type="button"
                className="play-chart-day"
                title={`${d.date}: ${d.plays} ${ft.plays}, ${formatDuration(d.duration)}`}
                aria-label={`${d.date}: ${d.plays} ${ft.plays}, ${formatDuration(d.duration)}`}
                aria-pressed={isSelected}
                onMouseDown={() => handleBarMouseDown(i)}
                onMouseEnter={() => handleBarMouseEnter(i)}
                onClick={event => handleBarClick(i, event)}
              >
                <span className="play-chart-bar" aria-hidden style={{
                  height: `${Math.max((d.plays / maxDailyPlays) * 100, 2)}%`,
                  background: isSelected
                    ? 'var(--portal-primary)'
                    : isInactive
                      ? 'var(--portal-primary-soft)'
                      : d.plays > 0 ? 'var(--portal-chart)' : 'var(--portal-fill)',
                  borderRadius: '2px 2px 0 0',
                  transition: 'background 0.15s',
                }} />
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '-6px 4px 0', fontSize: 12, color: 'var(--portal-muted)' }}>
          <span>{dailyTrend[0]?.date}</span>
          <span>{dailyTrend[dailyTrend.length - 1]?.date}</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="segmented" role="tablist" aria-label="Breakdown" style={{ marginTop: 28, marginBottom: 4, maxWidth: 620 }}>
        {([
          { key: 'campaigns', label: ft.tabCampaigns, icon: Megaphone },
          { key: 'devices', label: ft.tabDevices, icon: Monitor },
          { key: 'daily', label: ft.tabDaily, icon: BarChart3 },
          { key: 'map', label: ft.tabMap, icon: MapPin },
        ] as const).map(tab => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon size={14} aria-hidden style={{ verticalAlign: -2, marginRight: 6 }} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="portal-section">
        {activeTab === 'campaigns' && (
          <>
            <h2>{ft.perCampaign} {hasSelection && <span style={{ fontSize: 13, color: 'var(--portal-muted)', fontWeight: 400 }}>({selLabel})</span>}</h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{ft.campaign}</th>
                    <th style={{ textAlign: 'right' }}>{ft.plays}</th>
                    <th style={{ textAlign: 'right' }}>{ft.screenTime}</th>
                    <th style={{ textAlign: 'right' }}>{ft.devices}</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignNames.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--portal-muted)' }}>{ft.noData}</td></tr>
                  ) : campaignNames.map(name => {
                    const cp = campaignPlays[name]
                    return (
                      <tr key={name}>
                        <td style={{ fontWeight: 600 }}>{name}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cp.plays.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatDuration(cp.duration)}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cp.devices.size}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'devices' && (
          <>
            <h2>{ft.perDevice} {hasSelection && <span style={{ fontSize: 13, color: 'var(--portal-muted)', fontWeight: 400 }}>({selLabel})</span>}</h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{ft.deviceId}</th>
                    <th style={{ textAlign: 'right' }}>{ft.plays}</th>
                    <th style={{ textAlign: 'right' }}>{ft.screenTime}</th>
                    <th style={{ textAlign: 'right' }}>{ft.campaigns}</th>
                  </tr>
                </thead>
                <tbody>
                  {myDeviceIds.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--portal-muted)' }}>{ft.noData}</td></tr>
                  ) : myDeviceIds.map(id => {
                    const dp = devicePlays[id]
                    return (
                      <tr key={id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{id}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(dp?.plays || 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatDuration(dp?.duration || 0)}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{dp?.campaigns.size || 0}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'daily' && (
          <>
            <h2>{ft.dailyBreakdown} {hasSelection && <span style={{ fontSize: 13, color: 'var(--portal-muted)', fontWeight: 400 }}>({selLabel})</span>}</h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{ft.date}</th>
                    <th style={{ textAlign: 'right' }}>{ft.plays}</th>
                    <th style={{ textAlign: 'right' }}>{ft.screenTime}</th>
                  </tr>
                </thead>
                <tbody>
                  {(hasSelection
                    ? dailyTrend.slice(selMin, selMax + 1).reverse()
                    : dailyTrend.slice().reverse()
                  ).map(d => (
                    <tr key={d.date} style={{ opacity: d.plays === 0 ? 0.4 : 1 }}>
                      <td>{d.date}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.plays.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatDuration(d.duration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'map' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>{ft.playLocations}</h2>
              <span style={{ fontSize: 12, color: 'var(--portal-muted)', marginLeft: 4 }}>
                {mapPoints.length.toLocaleString()} {ft.playsOnMap}
              </span>
            </div>

            {/* Filters row */}
            <div style={{
              display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end',
              marginBottom: 12, padding: '12px 16px',
              background: 'var(--portal-surface)', borderRadius: '0.75rem',
              border: '1px solid var(--portal-border)',
            }}>
              <FilterSelect label={ft.campaign} value={mapCampaign} options={campaignOptions} onChange={setMapCampaign} />
              <FilterSelect label={ft.device} value={mapDevice} options={deviceOptions} onChange={setMapDevice} />

              <div style={{ flex: 1, minWidth: 200 }}>
                <HourRange start={hourRange[0]} end={hourRange[1]} onChange={setHourRange} label={ft.timeOfDay} fromLabel={ft.startHour} toLabel={ft.endHour} />
              </div>
            </div>

            <div style={{
              height: 480, borderRadius: '0.75rem', overflow: 'hidden',
              border: '1px solid var(--portal-border)',
            }}>
              <StatsMapView points={mapPoints} showDistricts />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
