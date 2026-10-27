'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { BarChart3, Play, Clock, Monitor, Megaphone, FolderOpen, X, MapPin, ChevronDown } from 'lucide-react'
import StatusBadge from '@/components/app/StatusBadge'
import HourRange from '@/components/app/HourRange'
import { useAdminText } from '@/lib/admin-i18n'

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

interface CampaignInfo {
  id: string
  name: string
  status: string
  clientName: string
  groupName: string
  groupId: string | null
  mediaCount: number
  isDeleted?: boolean
}

interface DeviceInfo {
  id: string
  groupName: string
  groupId: string | null
  lastSeen: string
}

interface GroupInfo {
  id: string
  name: string
  deviceIds: string[]
  campaignCount: number
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

function durationText(seconds: number, t: (en: string, vars?: Record<string, number>) => string): string {
  if (seconds < 60) return t('{s}s', { s: seconds })
  if (seconds < 3600) return t('{m}m {s}s', { m: Math.floor(seconds / 60), s: seconds % 60 })
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m > 0 ? t('{h}h {m}m', { h, m }) : t('{h}h', { h })
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
      <label style={{ fontSize: 11, color: 'var(--muted-foreground)', display: 'block', marginBottom: 4 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <select
          aria-label={label}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', padding: '6px 28px 6px 10px', fontSize: 13,
            background: 'var(--card)', color: 'var(--foreground)',
            border: '1px solid var(--border)', borderRadius: 8,
            appearance: 'none', cursor: 'pointer',
          }}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none', color: 'var(--muted-foreground)',
        }} />
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function AdminStatsPage() {
  const { t, locale } = useAdminText()
  const dur = (seconds: number) => durationText(seconds, t)
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [allLogs, setAllLogs] = useState<PlayLog[]>([])
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([])
  const [liveCampaigns, setLiveCampaigns] = useState<CampaignInfo[]>([])
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [totalDevices, setTotalDevices] = useState(0)
  const [totalCampaigns, setTotalCampaigns] = useState(0)
  const [activeCampaigns, setActiveCampaigns] = useState(0)
  const [activeTab, setActiveTab] = useState<'campaigns' | 'devices' | 'groups' | 'daily' | 'map'>('campaigns')

  // Date range selection
  const [selStart, setSelStart] = useState<number | null>(null)
  const [selEnd, setSelEnd] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<number | null>(null)
  const dragMoved = useRef(false)
  const selectionAnchor = useRef<number | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && chartRef.current) chartRef.current.scrollLeft = chartRef.current.scrollWidth
  }, [dailyTrend, loading])

  // Map filters
  const [mapCampaign, setMapCampaign] = useState('all')
  const [mapGroup, setMapGroup] = useState('all')
  const [mapDevice, setMapDevice] = useState('all')
  const [hourRange, setHourRange] = useState<[number, number]>([0, 23])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [
        { count: devCount, error: devError },
        { count: campCount, error: campError },
        { count: activeCount, error: activeError },
      ] = await Promise.all([
        supabase.from('devices').select('*', { count: 'exact', head: true }),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      ])
      if (devError || campError || activeError) throw devError || campError || activeError
      setTotalDevices(devCount || 0)
      setTotalCampaigns(campCount || 0)
      setActiveCampaigns(activeCount || 0)

      // Fetch ALL play_logs with needed fields (including lat/lng for map)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      let allFetched: PlayLog[] = []
      let page = 0
      const PAGE_SIZE = 1000
      while (true) {
        const { data: batch, error } = await supabase
          .from('play_logs')
          .select('campaign_id, program_name, device_id, began_at, duration_seconds, lat, lng')
          .gte('began_at', thirtyDaysAgo.toISOString())
          .order('began_at', { ascending: true })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
        if (error) throw error
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

      // Campaign info
      const { data: campData, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, name, status, device_group_id, clients(company_name), device_groups(name)')
        .order('created_at', { ascending: false })
      if (campaignError) throw campaignError
      const { data: mediaData, error: mediaError } = await supabase.from('ad_media').select('campaign_id')
      if (mediaError) throw mediaError
      const mediaCounts: Record<string, number> = {}
      for (const m of mediaData || []) mediaCounts[m.campaign_id] = (mediaCounts[m.campaign_id] || 0) + 1

      const campaigns: CampaignInfo[] = (campData || []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        name: c.name as string,
        status: c.status as string,
        clientName: (c.clients as { company_name: string } | null)?.company_name || '—',
        groupName: (c.device_groups as { name: string } | null)?.name || '—',
        groupId: (c.device_group_id as string) || null,
        mediaCount: mediaCounts[c.id as string] || 0,
      }))
      setLiveCampaigns(campaigns)

      // Device info
      const { data: devData, error: deviceError } = await supabase
        .from('devices')
        .select('id, last_seen_at, group_id, device_groups(name)')
        .order('last_seen_at', { ascending: false })
      if (deviceError) throw deviceError
      setDevices((devData || []).map((d: Record<string, unknown>) => ({
        id: d.id as string,
        groupName: (d.device_groups as { name: string } | null)?.name || '—',
        groupId: (d.group_id as string) || null,
        lastSeen: (d.last_seen_at as string) || '—',
      })))

      // Group info
      const { data: grpData, error: groupError } = await supabase.from('device_groups').select('id, name')
      const { data: devList, error: deviceListError } = await supabase.from('devices').select('id, group_id')
      const { data: campList, error: campaignListError } = await supabase.from('campaigns').select('id, device_group_id')
      if (groupError || deviceListError || campaignListError) throw groupError || deviceListError || campaignListError
      setGroups((grpData || []).map(g => ({
        id: g.id,
        name: g.name,
        deviceIds: (devList || []).filter(d => d.group_id === g.id).map(d => d.id),
        campaignCount: (campList || []).filter(c => c.device_group_id === g.id).length,
      })))
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { void load() }, [load])

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

  // Build lookup: device → group
  const deviceGroupMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const d of devices) {
      if (d.groupId) m[d.id] = d.groupId
    }
    return m
  }, [devices])

  // Build lookup: campaign name (lowercase) → campaign
  const campaignByName = useMemo(() => {
    const m = new Map<string, CampaignInfo>()
    for (const c of liveCampaigns) m.set(c.name.toLowerCase(), c)
    return m
  }, [liveCampaigns])

  // Map points: apply all filters (date range already applied via `logs`)
  const mapPoints = useMemo(() => {
    return logs.filter(l => {
      // Must have valid GPS
      if (!l.lat || !l.lng) return false
      // Campaign filter
      if (mapCampaign !== 'all' && l.program_name.toLowerCase() !== mapCampaign) return false
      // Group filter
      if (mapGroup !== 'all') {
        const camp = campaignByName.get(l.program_name.toLowerCase())
        const deviceGroup = deviceGroupMap[l.device_id]
        const campGroup = camp?.groupId
        if (campGroup !== mapGroup && deviceGroup !== mapGroup) return false
      }
      // Device filter
      if (mapDevice !== 'all' && l.device_id !== mapDevice) return false
      // Hour filter
      const hour = toTbilisiHour(l.began_at)
      if (hour < hourRange[0] || hour > hourRange[1]) return false
      return true
    })
  }, [logs, mapCampaign, mapGroup, mapDevice, hourRange, campaignByName, deviceGroupMap])

  // Build filter options from current data
  const campaignOptions = useMemo(() => {
    const names = new Set<string>()
    for (const l of logs) {
      if (l.program_name && l.program_name !== 'unknown') names.add(l.program_name)
    }
    return [
      { value: 'all', label: t('All campaigns') },
      ...Array.from(names).sort().map(n => ({ value: n.toLowerCase(), label: n })),
    ]
  }, [logs, t])

  const groupOptions = useMemo(() => [
    { value: 'all', label: t('All groups') },
    ...groups.map(g => ({ value: g.id, label: g.name })),
  ], [groups, t])

  const deviceOptions = useMemo(() => {
    const ids = new Set<string>()
    for (const l of logs) ids.add(l.device_id)
    return [
      { value: 'all', label: t('All devices') },
      ...Array.from(ids).sort().map(id => ({ value: id, label: id })),
    ]
  }, [logs, t])

  // Compute stats from filtered logs
  const totalPlays = logs.length
  const totalDuration = logs.reduce((s, l) => s + (l.duration_seconds || 0), 0)

  const campaignPlays: Record<string, { plays: number; duration: number; devices: Set<string> }> = {}
  const devicePlays: Record<string, { plays: number; duration: number }> = {}
  for (const l of logs) {
    const key = l.program_name?.toLowerCase()
    if (key && key !== 'unknown') {
      if (!campaignPlays[key]) campaignPlays[key] = { plays: 0, duration: 0, devices: new Set() }
      campaignPlays[key].plays++
      campaignPlays[key].duration += l.duration_seconds || 0
      campaignPlays[key].devices.add(l.device_id)
    }
    if (!devicePlays[l.device_id]) devicePlays[l.device_id] = { plays: 0, duration: 0 }
    devicePlays[l.device_id].plays++
    devicePlays[l.device_id].duration += l.duration_seconds || 0
  }

  // When a date range is selected, only show campaigns that actually ran in that period
  const displayedCampaigns = (() => {
    if (!hasSelection) return liveCampaigns
    const liveNames = new Set(liveCampaigns.map(c => c.name.toLowerCase()))
    const deletedNames = new Set<string>()
    for (const l of logs) {
      if (!l.campaign_id && l.program_name && l.program_name !== 'unknown' && !liveNames.has(l.program_name.toLowerCase())) {
        deletedNames.add(l.program_name)
      }
    }
    const deleted: CampaignInfo[] = Array.from(deletedNames).map(name => ({
      id: `deleted:${name}`, name, status: 'deleted',
      clientName: '—', groupName: '—', groupId: null, mediaCount: 0, isDeleted: true,
    }))
    return [...liveCampaigns, ...deleted].filter(c =>
      (campaignPlays[c.name.toLowerCase()]?.plays || 0) > 0
    )
  })()

  // Bar interaction handlers
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

  if (loading) return <div className="portal-loading">{t('Loading…')}</div>
  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>{t('Could not load this page from the database. Please try again.')}</p>
        <button type="button" className="portal-btn-primary" onClick={() => void load()}>{t('Try again')}</button>
      </div>
    </div>
  )

  const maxDailyPlays = Math.max(...dailyTrend.map(d => d.plays), 1)
  const selMin = hasSelection ? Math.min(selStart!, selEnd!) : -1
  const selMax = hasSelection ? Math.max(selStart!, selEnd!) : -1

  return (
    <div className="portal-page" onMouseUp={handleBarMouseUp}>
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{t('Stats')}</h1>
          <p className="portal-subtitle">{t('Plays from the last 30 days. Select a first and last day, or drag across the chart.')}</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--portal-info-soft)' }}>
            <Play size={24} color="var(--portal-info)" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{totalPlays.toLocaleString()}</span>
            <span className="stat-card-label">{t('Plays, 30 days')}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--portal-success-soft)' }}>
            <Clock size={24} color="var(--portal-success)" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{dur(totalDuration)}</span>
            <span className="stat-card-label">{t('Screen time')}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--portal-warning-soft)' }}>
            <Monitor size={24} color="var(--portal-warning)" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{totalDevices}</span>
            <span className="stat-card-label">{t('Screens')}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--portal-fill)' }}>
            <Megaphone size={24} color="var(--portal-brass)" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{activeCampaigns} / {totalCampaigns}</span>
            <span className="stat-card-label">{t('Active campaigns')}</span>
          </div>
        </div>
      </div>

      {/* Selectable Daily Chart */}
      <div className="portal-section" style={{ marginBottom: '2rem' }}>
        <div className="section-head">
          <h2>{t('Last 30 days')}</h2>
          {hasSelection && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--portal-text-soft)', fontWeight: 500 }}>{selLabel}</span>
              <button type="button" onClick={clearSelection} className="action-btn">
                <X size={12} aria-hidden /> {t('Clear')}
              </button>
            </div>
          )}
        </div>
        <div
          className="play-chart"
          ref={chartRef}
          role="group"
          aria-label={t('Daily plays, select a first and last day')}
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
                aria-label={`${d.date}: ${t('{n} plays', { n: d.plays })}, ${dur(d.duration)}`}
                aria-pressed={isSelected}
                title={`${d.date}: ${t('{n} plays', { n: d.plays })}, ${dur(d.duration)}`}
                onMouseDown={() => handleBarMouseDown(i)}
                onMouseEnter={() => handleBarMouseEnter(i)}
                onClick={event => handleBarClick(i, event)}
              >
                <span className="play-chart-bar" style={{
                  height: `${Math.max((d.plays / maxDailyPlays) * 100, 2)}%`,
                  background: isSelected
                    ? 'var(--portal-primary)'
                    : isInactive
                      ? 'var(--portal-primary-soft)'
                      : d.plays > 0 ? 'var(--portal-primary)' : 'var(--portal-fill)',
                  opacity: !hasSelection && d.plays > 0 ? 0.55 : 1,
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
      <div className="segmented" role="tablist" aria-label={t('Breakdown')} style={{ marginTop: 28, marginBottom: 4, maxWidth: 720 }}>
        {([
          { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
          { key: 'devices', label: 'Devices', icon: Monitor },
          { key: 'groups', label: 'Groups', icon: FolderOpen },
          { key: 'daily', label: 'By day', icon: BarChart3 },
          { key: 'map', label: 'Map', icon: MapPin },
        ] as const).map(tab => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon size={14} aria-hidden style={{ verticalAlign: -2, marginRight: 6 }} />
            {t(tab.label)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="portal-section">
        {activeTab === 'campaigns' && (
          <>
            <h2>{t('By campaign')} {hasSelection && <span style={{ fontSize: 13, color: 'var(--portal-muted)', fontWeight: 400 }}>({selLabel})</span>}</h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{t('Campaign')}</th><th>{t('Client')}</th><th>{t('Group')}</th><th>{t('Status')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Plays')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Screen time')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Devices')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Media')}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedCampaigns.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>{t('No campaigns')}</td></tr>
                  ) : displayedCampaigns.map(c => {
                    const cp = campaignPlays[c.name.toLowerCase()]
                    return (
                      <tr key={c.id} style={{ opacity: c.isDeleted ? 0.65 : 1 }}>
                        <td style={{ fontWeight: 600 }}>
                          {c.name}
                          {c.isDeleted && (
                            <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--portal-danger)', fontWeight: 400 }}>({t('deleted')})</span>
                          )}
                        </td>
                        <td>{c.clientName}</td>
                        <td>{c.groupName}</td>
                        <td>
                          <StatusBadge status={c.status} />
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(cp?.plays || 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{dur(cp?.duration || 0)}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cp?.devices.size || 0}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.mediaCount}</td>
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
            <h2>{t('By device')} {hasSelection && <span style={{ fontSize: 13, color: 'var(--portal-muted)', fontWeight: 400 }}>({selLabel})</span>}</h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{t('Device ID')}</th><th>{t('Group')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Total plays')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Screen time')}</th>
                    <th>{t('Last seen')}</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>{t('No devices')}</td></tr>
                  ) : devices.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{d.id}</td>
                      <td>{d.groupName}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(devicePlays[d.id]?.plays || 0).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{dur(devicePlays[d.id]?.duration || 0)}</td>
                      <td style={{ color: 'var(--muted-foreground)' }}>{d.lastSeen !== '—' ? new Date(d.lastSeen).toLocaleString(locale, { timeZone: TZ }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'groups' && (
          <>
            <h2>{t('By group')} {hasSelection && <span style={{ fontSize: 13, color: 'var(--portal-muted)', fontWeight: 400 }}>({selLabel})</span>}</h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{t('Group')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Devices')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Campaigns')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Total plays')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Screen time')}</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>{t('No groups')}</td></tr>
                  ) : groups.map(g => {
                    let gPlays = 0, gDuration = 0
                    for (const did of g.deviceIds) {
                      gPlays += devicePlays[did]?.plays || 0
                      gDuration += devicePlays[did]?.duration || 0
                    }
                    return (
                      <tr key={g.id}>
                        <td style={{ fontWeight: 600 }}>{g.name}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{g.deviceIds.length}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{g.campaignCount}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{gPlays.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{dur(gDuration)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'map' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>{t('Play locations')}</h2>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)', marginLeft: 4 }}>
                {t('{n} plays on map', { n: mapPoints.length.toLocaleString() })}
              </span>
            </div>

            {/* Filters row */}
            <div style={{
              display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end',
              marginBottom: 12, padding: '12px 16px',
              background: 'var(--card)', borderRadius: '0.75rem',
              border: '1px solid var(--border)',
            }}>
              <FilterSelect label={t('Campaign')} value={mapCampaign} options={campaignOptions} onChange={setMapCampaign} />
              <FilterSelect label={t('Group')} value={mapGroup} options={groupOptions} onChange={setMapGroup} />
              <FilterSelect label={t('Device')} value={mapDevice} options={deviceOptions} onChange={setMapDevice} />

              <div style={{ flex: 1, minWidth: 200 }}>
                <HourRange start={hourRange[0]} end={hourRange[1]} onChange={setHourRange} label={t('Time of day')} fromLabel={t('Start hour')} toLabel={t('End hour')} />
              </div>
            </div>

            <div style={{
              height: 480, borderRadius: '0.75rem', overflow: 'hidden',
              border: '1px solid var(--border)',
            }}>
              <StatsMapView points={mapPoints} showDistricts />
            </div>
          </>
        )}

        {activeTab === 'daily' && (
          <>
            <h2>{t('By day')} {hasSelection && <span style={{ fontSize: 13, color: 'var(--portal-muted)', fontWeight: 400 }}>({selLabel})</span>}</h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{t('Date')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Plays')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Screen time')}</th>
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
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{dur(d.duration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
