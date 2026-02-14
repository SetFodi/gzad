'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart3, Play, Clock, Monitor, Megaphone, FolderOpen, X } from 'lucide-react'

interface PlayLog {
  campaign_id: string | null
  device_id: string
  began_at: string
  duration_seconds: number
}

interface CampaignInfo {
  id: string
  name: string
  status: string
  clientName: string
  groupName: string
  mediaCount: number
}

interface DeviceInfo {
  id: string
  groupName: string
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

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function AdminStatsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [allLogs, setAllLogs] = useState<PlayLog[]>([])
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([])
  const [campaigns, setCampaigns] = useState<CampaignInfo[]>([])
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [groups, setGroups] = useState<GroupInfo[]>([])
  const [totalDevices, setTotalDevices] = useState(0)
  const [totalCampaigns, setTotalCampaigns] = useState(0)
  const [activeCampaigns, setActiveCampaigns] = useState(0)
  const [totalGroups, setTotalGroups] = useState(0)
  const [activeTab, setActiveTab] = useState<'campaigns' | 'devices' | 'groups' | 'daily'>('campaigns')

  // Date range selection
  const [selStart, setSelStart] = useState<number | null>(null)
  const [selEnd, setSelEnd] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    const [
      { count: devCount },
      { count: campCount },
      { count: activeCount },
      { count: grpCount },
    ] = await Promise.all([
      supabase.from('devices').select('*', { count: 'exact', head: true }),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('device_groups').select('*', { count: 'exact', head: true }),
    ])
    setTotalDevices(devCount || 0)
    setTotalCampaigns(campCount || 0)
    setActiveCampaigns(activeCount || 0)
    setTotalGroups(grpCount || 0)

    // Fetch ALL play_logs with needed fields
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data: logs } = await supabase
      .from('play_logs')
      .select('campaign_id, device_id, began_at, duration_seconds')
      .gte('began_at', thirtyDaysAgo.toISOString())
      .order('began_at', { ascending: true })
    setAllLogs(logs || [])

    // Build daily trend
    const dailyMap: Record<string, { plays: number; duration: number }> = {}
    for (const log of logs || []) {
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
    const { data: campData } = await supabase
      .from('campaigns')
      .select('id, name, status, clients(company_name), device_groups(name)')
      .order('created_at', { ascending: false })
    const { data: mediaData } = await supabase.from('ad_media').select('campaign_id')
    const mediaCounts: Record<string, number> = {}
    for (const m of mediaData || []) mediaCounts[m.campaign_id] = (mediaCounts[m.campaign_id] || 0) + 1

    setCampaigns((campData || []).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      name: c.name as string,
      status: c.status as string,
      clientName: (c.clients as { company_name: string } | null)?.company_name || '—',
      groupName: (c.device_groups as { name: string } | null)?.name || '—',
      mediaCount: mediaCounts[c.id as string] || 0,
    })))

    // Device info
    const { data: devData } = await supabase
      .from('devices')
      .select('id, last_seen_at, group_id, device_groups(name)')
      .order('last_seen_at', { ascending: false })
    setDevices((devData || []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      groupName: (d.device_groups as { name: string } | null)?.name || '—',
      lastSeen: (d.last_seen_at as string) || '—',
    })))

    // Group info
    const { data: grpData } = await supabase.from('device_groups').select('id, name')
    const { data: devList } = await supabase.from('devices').select('id, group_id')
    const { data: campList } = await supabase.from('campaigns').select('id, device_group_id')
    setGroups((grpData || []).map(g => ({
      id: g.id,
      name: g.name,
      deviceIds: (devList || []).filter(d => d.group_id === g.id).map(d => d.id),
      campaignCount: (campList || []).filter(c => c.device_group_id === g.id).length,
    })))

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

  // Compute stats from filtered logs
  const totalPlays = logs.length
  const totalDuration = logs.reduce((s, l) => s + (l.duration_seconds || 0), 0)

  const campaignPlays: Record<string, { plays: number; duration: number; devices: Set<string> }> = {}
  const devicePlays: Record<string, { plays: number; duration: number }> = {}
  for (const l of logs) {
    if (l.campaign_id) {
      if (!campaignPlays[l.campaign_id]) campaignPlays[l.campaign_id] = { plays: 0, duration: 0, devices: new Set() }
      campaignPlays[l.campaign_id].plays++
      campaignPlays[l.campaign_id].duration += l.duration_seconds || 0
      campaignPlays[l.campaign_id].devices.add(l.device_id)
    }
    if (!devicePlays[l.device_id]) devicePlays[l.device_id] = { plays: 0, duration: 0 }
    devicePlays[l.device_id].plays++
    devicePlays[l.device_id].duration += l.duration_seconds || 0
  }

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

  const maxDailyPlays = Math.max(...dailyTrend.map(d => d.plays), 1)
  const selMin = hasSelection ? Math.min(selStart!, selEnd!) : -1
  const selMax = hasSelection ? Math.max(selStart!, selEnd!) : -1

  return (
    <div className="portal-page" onMouseUp={handleBarMouseUp}>
      <h1 className="portal-page-title">Play Statistics</h1>

      {/* Overview Cards */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(96,165,250,0.1)' }}>
            <Play size={24} color="#60A5FA" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{totalPlays.toLocaleString()}</span>
            <span className="stat-card-label">Total Plays</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(204,243,129,0.1)' }}>
            <Clock size={24} color="#CCF381" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{formatDuration(totalDuration)}</span>
            <span className="stat-card-label">Total Screen Time</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(251,191,36,0.1)' }}>
            <Monitor size={24} color="#FBBF24" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{totalDevices}</span>
            <span className="stat-card-label">Total Devices</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(167,139,250,0.1)' }}>
            <Megaphone size={24} color="#A78BFA" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{activeCampaigns} / {totalCampaigns}</span>
            <span className="stat-card-label">Active / Total Campaigns</span>
          </div>
        </div>
      </div>

      {/* Selectable Daily Chart */}
      <div className="portal-section" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Last 30 Days</h2>
          {hasSelection && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#60A5FA', fontWeight: 500 }}>{selLabel}</span>
              <button onClick={clearSelection} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                borderRadius: 6, fontSize: 12, border: '1px solid rgba(96,165,250,0.3)',
                background: 'rgba(96,165,250,0.08)', color: '#60A5FA', cursor: 'pointer',
              }}>
                <X size={12} /> Clear
              </button>
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'flex-end', gap: '2px', height: '100px',
            padding: '1rem', background: 'var(--card)', borderRadius: '0.75rem',
            border: '1px solid var(--border)', userSelect: 'none',
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
          { key: 'campaigns', label: 'Campaigns', icon: Megaphone },
          { key: 'devices', label: 'Devices', icon: Monitor },
          { key: 'groups', label: 'Groups', icon: FolderOpen },
          { key: 'daily', label: 'Daily Breakdown', icon: BarChart3 },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid',
              borderColor: activeTab === tab.key ? '#60A5FA' : 'var(--border)',
              background: activeTab === tab.key ? 'rgba(96,165,250,0.1)' : 'transparent',
              color: activeTab === tab.key ? '#60A5FA' : 'var(--muted-foreground)',
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
            <h2>Per-Campaign Stats {hasSelection && <span style={{ fontSize: 13, color: '#525252', fontWeight: 400 }}>({selLabel})</span>}</h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Campaign</th><th>Client</th><th>Group</th><th>Status</th>
                    <th style={{ textAlign: 'right' }}>Plays</th>
                    <th style={{ textAlign: 'right' }}>Screen Time</th>
                    <th style={{ textAlign: 'right' }}>Devices</th>
                    <th style={{ textAlign: 'right' }}>Media</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>No campaigns</td></tr>
                  ) : campaigns.map(c => {
                    const cp = campaignPlays[c.id]
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td>{c.clientName}</td>
                        <td>{c.groupName}</td>
                        <td>
                          <span className="status-badge" style={{
                            color: c.status === 'active' ? '#CCF381' : c.status === 'pending_review' ? '#FBBF24' : '#64748B',
                            borderColor: c.status === 'active' ? '#CCF381' : c.status === 'pending_review' ? '#FBBF24' : '#64748B',
                          }}>{c.status.replace('_', ' ')}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(cp?.plays || 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatDuration(cp?.duration || 0)}</td>
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
            <h2>Per-Device Stats {hasSelection && <span style={{ fontSize: 13, color: '#525252', fontWeight: 400 }}>({selLabel})</span>}</h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Device ID</th><th>Group</th>
                    <th style={{ textAlign: 'right' }}>Total Plays</th>
                    <th style={{ textAlign: 'right' }}>Screen Time</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>No devices</td></tr>
                  ) : devices.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{d.id}</td>
                      <td>{d.groupName}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(devicePlays[d.id]?.plays || 0).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatDuration(devicePlays[d.id]?.duration || 0)}</td>
                      <td style={{ color: 'var(--muted-foreground)' }}>{d.lastSeen !== '—' ? new Date(d.lastSeen).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'groups' && (
          <>
            <h2>Per-Group Stats {hasSelection && <span style={{ fontSize: 13, color: '#525252', fontWeight: 400 }}>({selLabel})</span>}</h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th style={{ textAlign: 'right' }}>Devices</th>
                    <th style={{ textAlign: 'right' }}>Campaigns</th>
                    <th style={{ textAlign: 'right' }}>Total Plays</th>
                    <th style={{ textAlign: 'right' }}>Screen Time</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>No groups</td></tr>
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
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatDuration(gDuration)}</td>
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
            <h2>Daily Breakdown {hasSelection && <span style={{ fontSize: 13, color: '#525252', fontWeight: 400 }}>({selLabel})</span>}</h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Plays</th>
                    <th style={{ textAlign: 'right' }}>Screen Time</th>
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
      </div>
    </div>
  )
}
