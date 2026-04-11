'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
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

function formatHour(h: number): string {
  return `${h.toString().padStart(2, '0')}:00`
}

// ─── Dual-handle range slider ────────────────────────────────────────────────
function RangeSlider({ min, max, value, onChange }: {
  min: number; max: number
  value: [number, number]
  onChange: (v: [number, number]) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<'low' | 'high' | null>(null)

  function pctFromEvent(e: React.MouseEvent | MouseEvent) {
    const rect = trackRef.current!.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }
  function valFromPct(pct: number) {
    return Math.round(min + pct * (max - min))
  }

  function onMouseDown(handle: 'low' | 'high') {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      draggingRef.current = handle
      const onMove = (ev: MouseEvent) => {
        const v = valFromPct(pctFromEvent(ev))
        if (draggingRef.current === 'low') {
          onChange([Math.min(v, value[1]), value[1]])
        } else {
          onChange([value[0], Math.max(v, value[0])])
        }
      }
      const onUp = () => {
        draggingRef.current = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    }
  }

  const lowPct = ((value[0] - min) / (max - min)) * 100
  const highPct = ((value[1] - min) / (max - min)) * 100

  return (
    <div style={{ position: 'relative', height: 36, userSelect: 'none' }}>
      <div ref={trackRef} style={{
        position: 'absolute', top: 14, left: 0, right: 0, height: 8,
        background: '#27272a', borderRadius: 4,
      }}>
        <div style={{
          position: 'absolute', top: 0, left: `${lowPct}%`, width: `${highPct - lowPct}%`,
          height: '100%', background: '#60A5FA', borderRadius: 4,
        }} />
      </div>
      <div onMouseDown={onMouseDown('low')} style={{
        position: 'absolute', top: 8, left: `${lowPct}%`, transform: 'translateX(-50%)',
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        border: '2px solid #60A5FA', cursor: 'grab', zIndex: 2,
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }} />
      <div onMouseDown={onMouseDown('high')} style={{
        position: 'absolute', top: 8, left: `${highPct}%`, transform: 'translateX(-50%)',
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        border: '2px solid #60A5FA', cursor: 'grab', zIndex: 2,
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }} />
    </div>
  )
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
      <label style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 4 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', padding: '6px 28px 6px 10px', fontSize: 13,
            background: '#0A0A0A', color: '#e4e4e7',
            border: '1px solid #27272a', borderRadius: 8,
            appearance: 'none', cursor: 'pointer', outline: 'none',
          }}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none', color: '#71717a',
        }} />
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function FleetStatsPage() {
  const supabase = createClient()
  const { t } = useTranslations()
  const ft = t.fleet.stats

  const [loading, setLoading] = useState(true)
  const [myDeviceIds, setMyDeviceIds] = useState<string[]>([])
  const [allLogs, setAllLogs] = useState<PlayLog[]>([])
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([])
  const [activeTab, setActiveTab] = useState<'campaigns' | 'devices' | 'daily' | 'map'>('campaigns')

  // Date range selection
  const [selStart, setSelStart] = useState<number | null>(null)
  const [selEnd, setSelEnd] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<number | null>(null)

  // Map filters
  const [mapCampaign, setMapCampaign] = useState('all')
  const [mapDevice, setMapDevice] = useState('all')
  const [hourRange, setHourRange] = useState<[number, number]>([0, 23])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    // Get current user's fleet vehicles with assigned devices
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (!client) return

    const { data: vehicles } = await supabase
      .from('fleet_vehicles')
      .select('device_id')
      .eq('fleet_user_id', client.id)
      .not('device_id', 'is', null)

    const deviceIds = (vehicles || []).map(v => v.device_id!).filter(Boolean)
    setMyDeviceIds(deviceIds)

    if (deviceIds.length === 0) {
      setLoading(false)
      return
    }

    // Fetch play_logs for these devices (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    let allFetched: PlayLog[] = []
    let page = 0
    const PAGE_SIZE = 1000
    while (true) {
      const { data: batch } = await supabase
        .from('play_logs')
        .select('campaign_id, program_name, device_id, began_at, duration_seconds, lat, lng')
        .in('device_id', deviceIds)
        .gte('began_at', thirtyDaysAgo.toISOString())
        .order('began_at', { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      if (!batch || batch.length === 0) break
      allFetched = allFetched.concat(batch)
      if (batch.length < PAGE_SIZE) break
      page++
    }
    setAllLogs(allFetched)

    // Build daily trend
    const dailyMap: Record<string, { plays: number; duration: number }> = {}
    for (const log of allFetched) {
      const date = toTbilisiDate(log.began_at)
      if (!dailyMap[date]) dailyMap[date] = { plays: 0, duration: 0 }
      dailyMap[date].plays++
      dailyMap[date].duration += log.duration_seconds || 0
    }
    const trend: DailyTrend[] = []
    const d = new Date(thirtyDaysAgo)
    const today = new Date()
    while (d <= today) {
      const dateStr = toTbilisiDate(d.toISOString())
      trend.push({ date: dateStr, plays: dailyMap[dateStr]?.plays || 0, duration: dailyMap[dateStr]?.duration || 0 })
      d.setDate(d.getDate() + 1)
    }
    setDailyTrend(trend)

    setLoading(false)
  }

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

  // Bar interaction handlers
  const handleBarMouseDown = (index: number) => {
    dragStart.current = index
    setDragging(true)
    setSelStart(index)
    setSelEnd(index)
  }
  const handleBarMouseEnter = (index: number) => {
    if (dragging && dragStart.current !== null) {
      setSelStart(dragStart.current)
      setSelEnd(index)
    }
  }
  const handleBarMouseUp = () => {
    setDragging(false)
    dragStart.current = null
  }
  const clearSelection = () => {
    setSelStart(null)
    setSelEnd(null)
    setDragging(false)
    dragStart.current = null
  }

  if (loading) return <div className="portal-loading">Loading...</div>

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
          <div className="stat-card-icon" style={{ background: 'rgba(96,165,250,0.1)' }}>
            <Play size={24} color="#60A5FA" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{totalPlays.toLocaleString()}</span>
            <span className="stat-card-label">{ft.totalPlays}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(204,243,129,0.1)' }}>
            <Clock size={24} color="#CCF381" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{formatDuration(totalDuration)}</span>
            <span className="stat-card-label">{ft.totalScreenTime}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(251,191,36,0.1)' }}>
            <Monitor size={24} color="#FBBF24" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{myDeviceIds.length}</span>
            <span className="stat-card-label">{ft.yourDevices}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(167,139,250,0.1)' }}>
            <Megaphone size={24} color="#A78BFA" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{campaignNames.length}</span>
            <span className="stat-card-label">{ft.campaignsShown}</span>
          </div>
        </div>
      </div>

      {/* Selectable Daily Chart */}
      <div className="portal-section" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{ft.last30Days}</h2>
          {hasSelection && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#60A5FA', fontWeight: 500 }}>{selLabel}</span>
              <button onClick={clearSelection} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                borderRadius: 6, fontSize: 12, border: '1px solid rgba(96,165,250,0.3)',
                background: 'rgba(96,165,250,0.08)', color: '#60A5FA', cursor: 'pointer',
              }}>
                <X size={12} /> {ft.clear}
              </button>
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'flex-end', gap: '2px', height: '100px',
            padding: '1rem', background: '#0A0A0A', borderRadius: '0.75rem',
            border: '1px solid #27272a', userSelect: 'none',
          }}
          onMouseLeave={() => { if (dragging) handleBarMouseUp() }}
        >
          {dailyTrend.map((d, i) => {
            const isSelected = hasSelection && i >= selMin && i <= selMax
            const isInactive = hasSelection && !isSelected
            return (
              <div
                key={d.date}
                title={`${d.date}: ${d.plays} plays, ${formatDuration(d.duration)}`}
                onMouseDown={() => handleBarMouseDown(i)}
                onMouseEnter={() => handleBarMouseEnter(i)}
                style={{
                  flex: 1,
                  height: `${Math.max((d.plays / maxDailyPlays) * 100, 2)}%`,
                  background: isSelected
                    ? '#60A5FA'
                    : isInactive
                      ? 'rgba(96,165,250,0.1)'
                      : d.plays > 0 ? 'rgba(96,165,250,0.5)' : 'rgba(96,165,250,0.12)',
                  borderRadius: '2px 2px 0 0',
                  minWidth: '3px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              />
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: '#525252' }}>
          <span>{dailyTrend[0]?.date}</span>
          <span>{dailyTrend[dailyTrend.length - 1]?.date}</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {([
          { key: 'campaigns', label: ft.tabCampaigns, icon: Megaphone },
          { key: 'devices', label: ft.tabDevices, icon: Monitor },
          { key: 'daily', label: ft.tabDaily, icon: BarChart3 },
          { key: 'map', label: ft.tabMap, icon: MapPin },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid',
              borderColor: activeTab === tab.key ? '#60A5FA' : '#27272a',
              background: activeTab === tab.key ? 'rgba(96,165,250,0.1)' : 'transparent',
              color: activeTab === tab.key ? '#60A5FA' : '#71717a',
              cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="portal-section">
        {activeTab === 'campaigns' && (
          <>
            <h2>{ft.perCampaign} {hasSelection && <span style={{ fontSize: 13, color: '#525252', fontWeight: 400 }}>({selLabel})</span>}</h2>
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
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: '#71717a' }}>{ft.noData}</td></tr>
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
            <h2>{ft.perDevice} {hasSelection && <span style={{ fontSize: 13, color: '#525252', fontWeight: 400 }}>({selLabel})</span>}</h2>
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
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: '#71717a' }}>{ft.noData}</td></tr>
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
            <h2>{ft.dailyBreakdown} {hasSelection && <span style={{ fontSize: 13, color: '#525252', fontWeight: 400 }}>({selLabel})</span>}</h2>
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
              <span style={{ fontSize: 12, color: '#71717a', marginLeft: 4 }}>
                {mapPoints.length.toLocaleString()} {ft.playsOnMap}
              </span>
            </div>

            {/* Filters row */}
            <div style={{
              display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end',
              marginBottom: 12, padding: '12px 16px',
              background: '#0A0A0A', borderRadius: '0.75rem',
              border: '1px solid #27272a',
            }}>
              <FilterSelect label={ft.campaign} value={mapCampaign} options={campaignOptions} onChange={setMapCampaign} />
              <FilterSelect label={ft.device} value={mapDevice} options={deviceOptions} onChange={setMapDevice} />

              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 4 }}>
                  {ft.timeOfDay}: {formatHour(hourRange[0])} — {formatHour(hourRange[1])}
                </label>
                <RangeSlider min={0} max={23} value={hourRange} onChange={setHourRange} />
              </div>
            </div>

            <div style={{
              height: 480, borderRadius: '0.75rem', overflow: 'hidden',
              border: '1px solid #27272a',
            }}>
              <StatsMapView points={mapPoints} showDistricts />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
