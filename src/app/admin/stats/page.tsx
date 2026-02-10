'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart3, Play, Clock, Monitor, Megaphone, FolderOpen } from 'lucide-react'

interface OverviewStats {
  totalPlays: number
  totalDuration: number
  totalDevices: number
  totalCampaigns: number
  totalGroups: number
  activeCampaigns: number
}

interface CampaignStat {
  id: string
  name: string
  clientName: string
  groupName: string
  status: string
  plays: number
  duration: number
  uniqueDevices: number
  mediaCount: number
}

interface DeviceStat {
  id: string
  groupName: string
  totalPlays: number
  lastSeen: string
  totalDuration: number
}

interface GroupStat {
  id: string
  name: string
  deviceCount: number
  campaignCount: number
  totalPlays: number
  totalDuration: number
}

interface DailyTrend {
  date: string
  plays: number
  duration: number
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export default function AdminStatsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [campaignStats, setCampaignStats] = useState<CampaignStat[]>([])
  const [deviceStats, setDeviceStats] = useState<DeviceStat[]>([])
  const [groupStats, setGroupStats] = useState<GroupStat[]>([])
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([])
  const [activeTab, setActiveTab] = useState<'campaigns' | 'devices' | 'groups' | 'daily'>('campaigns')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    // --- Overview ---
    const [
      { count: totalDevices },
      { count: totalCampaigns },
      { count: activeCampaigns },
      { count: totalGroups },
      { data: playStatsAll },
      { data: playLogsAll },
    ] = await Promise.all([
      supabase.from('devices').select('*', { count: 'exact', head: true }),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('device_groups').select('*', { count: 'exact', head: true }),
      supabase.from('play_stats').select('play_count, total_duration_seconds'),
      supabase.from('play_logs').select('duration_seconds'),
    ])

    const statsPlays = playStatsAll?.reduce((s, r) => s + (r.play_count || 0), 0) || 0
    const statsDuration = playStatsAll?.reduce((s, r) => s + (r.total_duration_seconds || 0), 0) || 0
    // If play_stats is empty, fall back to raw play_logs
    const logsPlays = playLogsAll?.length || 0
    const logsDuration = playLogsAll?.reduce((s, r) => s + (r.duration_seconds || 0), 0) || 0

    setOverview({
      totalPlays: statsPlays || logsPlays,
      totalDuration: statsDuration || logsDuration,
      totalDevices: totalDevices || 0,
      totalCampaigns: totalCampaigns || 0,
      totalGroups: totalGroups || 0,
      activeCampaigns: activeCampaigns || 0,
    })

    // --- Per-Campaign Stats ---
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, status, client_id, device_group_id, clients(company_name), device_groups(name)')
      .order('created_at', { ascending: false })

    const { data: allPlayStats } = await supabase.from('play_stats').select('campaign_id, play_count, total_duration_seconds, unique_taxis')
    const { data: allMedia } = await supabase.from('ad_media').select('campaign_id')

    // Also get play counts from play_logs for campaigns without play_stats
    const { data: logsByCampaign } = await supabase
      .from('play_logs')
      .select('campaign_id, duration_seconds')
      .not('campaign_id', 'is', null)

    const playStatsByCampaign: Record<string, { plays: number; duration: number; devices: number }> = {}
    for (const ps of allPlayStats || []) {
      if (!ps.campaign_id) continue
      if (!playStatsByCampaign[ps.campaign_id]) {
        playStatsByCampaign[ps.campaign_id] = { plays: 0, duration: 0, devices: 0 }
      }
      playStatsByCampaign[ps.campaign_id].plays += ps.play_count || 0
      playStatsByCampaign[ps.campaign_id].duration += ps.total_duration_seconds || 0
      playStatsByCampaign[ps.campaign_id].devices = Math.max(playStatsByCampaign[ps.campaign_id].devices, ps.unique_taxis || 0)
    }

    const logStatsByCampaign: Record<string, { plays: number; duration: number }> = {}
    for (const log of logsByCampaign || []) {
      if (!log.campaign_id) continue
      if (!logStatsByCampaign[log.campaign_id]) logStatsByCampaign[log.campaign_id] = { plays: 0, duration: 0 }
      logStatsByCampaign[log.campaign_id].plays++
      logStatsByCampaign[log.campaign_id].duration += log.duration_seconds || 0
    }

    const mediaCountByCampaign: Record<string, number> = {}
    for (const m of allMedia || []) {
      mediaCountByCampaign[m.campaign_id] = (mediaCountByCampaign[m.campaign_id] || 0) + 1
    }

    const cStats: CampaignStat[] = (campaigns || []).map((c: Record<string, unknown>) => {
      const ps = playStatsByCampaign[c.id as string]
      const ls = logStatsByCampaign[c.id as string]
      return {
        id: c.id as string,
        name: c.name as string,
        clientName: (c.clients as { company_name: string } | null)?.company_name || '—',
        groupName: (c.device_groups as { name: string } | null)?.name || '—',
        status: c.status as string,
        plays: ps?.plays || ls?.plays || 0,
        duration: ps?.duration || ls?.duration || 0,
        uniqueDevices: ps?.devices || 0,
        mediaCount: mediaCountByCampaign[c.id as string] || 0,
      }
    })
    setCampaignStats(cStats)

    // --- Per-Device Stats ---
    const { data: devicesData } = await supabase
      .from('devices')
      .select('id, last_seen_at, group_id, device_groups(name)')
      .order('last_seen_at', { ascending: false })

    const { data: logsByDevice } = await supabase
      .from('play_logs')
      .select('device_id, duration_seconds')

    const devicePlayMap: Record<string, { plays: number; duration: number }> = {}
    for (const log of logsByDevice || []) {
      if (!devicePlayMap[log.device_id]) devicePlayMap[log.device_id] = { plays: 0, duration: 0 }
      devicePlayMap[log.device_id].plays++
      devicePlayMap[log.device_id].duration += log.duration_seconds || 0
    }

    const dStats: DeviceStat[] = (devicesData || []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      groupName: (d.device_groups as { name: string } | null)?.name || '—',
      totalPlays: devicePlayMap[d.id as string]?.plays || 0,
      lastSeen: d.last_seen_at as string || '—',
      totalDuration: devicePlayMap[d.id as string]?.duration || 0,
    }))
    setDeviceStats(dStats)

    // --- Per-Group Stats ---
    const { data: groups } = await supabase.from('device_groups').select('id, name')
    const { data: devicesList } = await supabase.from('devices').select('id, group_id')
    const { data: campaignsList } = await supabase.from('campaigns').select('id, device_group_id')

    const gStats: GroupStat[] = (groups || []).map(g => {
      const groupDeviceIds = (devicesList || []).filter(d => d.group_id === g.id).map(d => d.id)
      const groupCampaignCount = (campaignsList || []).filter(c => c.device_group_id === g.id).length
      let groupPlays = 0
      let groupDuration = 0
      for (const did of groupDeviceIds) {
        groupPlays += devicePlayMap[did]?.plays || 0
        groupDuration += devicePlayMap[did]?.duration || 0
      }
      return {
        id: g.id,
        name: g.name,
        deviceCount: groupDeviceIds.length,
        campaignCount: groupCampaignCount,
        totalPlays: groupPlays,
        totalDuration: groupDuration,
      }
    })
    setGroupStats(gStats)

    // --- Daily Trend (last 30 days) ---
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data: dailyLogs } = await supabase
      .from('play_logs')
      .select('began_at, duration_seconds')
      .gte('began_at', thirtyDaysAgo.toISOString())
      .order('began_at', { ascending: true })

    const dailyMap: Record<string, { plays: number; duration: number }> = {}
    for (const log of dailyLogs || []) {
      const date = (log.began_at as string).split('T')[0]
      if (!dailyMap[date]) dailyMap[date] = { plays: 0, duration: 0 }
      dailyMap[date].plays++
      dailyMap[date].duration += log.duration_seconds || 0
    }

    // Fill in missing days
    const trend: DailyTrend[] = []
    const d = new Date(thirtyDaysAgo)
    const today = new Date()
    while (d <= today) {
      const dateStr = d.toISOString().split('T')[0]
      trend.push({
        date: dateStr,
        plays: dailyMap[dateStr]?.plays || 0,
        duration: dailyMap[dateStr]?.duration || 0,
      })
      d.setDate(d.getDate() + 1)
    }
    setDailyTrend(trend)

    setLoading(false)
  }

  if (loading) return <div className="portal-loading">Loading...</div>
  if (!overview) return null

  const maxDailyPlays = Math.max(...dailyTrend.map(d => d.plays), 1)

  return (
    <div className="portal-page">
      <h1 className="portal-page-title">Play Statistics</h1>

      {/* Overview Cards */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(96,165,250,0.1)' }}>
            <Play size={24} color="#60A5FA" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{overview.totalPlays.toLocaleString()}</span>
            <span className="stat-card-label">Total Plays</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(204,243,129,0.1)' }}>
            <Clock size={24} color="#CCF381" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{formatDuration(overview.totalDuration)}</span>
            <span className="stat-card-label">Total Screen Time</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(251,191,36,0.1)' }}>
            <Monitor size={24} color="#FBBF24" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{overview.totalDevices}</span>
            <span className="stat-card-label">Total Devices</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(167,139,250,0.1)' }}>
            <Megaphone size={24} color="#A78BFA" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{overview.activeCampaigns} / {overview.totalCampaigns}</span>
            <span className="stat-card-label">Active / Total Campaigns</span>
          </div>
        </div>
      </div>

      {/* Daily Trend Mini Chart */}
      <div className="portal-section" style={{ marginBottom: '2rem' }}>
        <h2>Last 30 Days</h2>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: '2px', height: '80px',
          padding: '1rem', background: 'var(--card)', borderRadius: '0.75rem',
          border: '1px solid var(--border)',
        }}>
          {dailyTrend.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.plays} plays, ${formatDuration(d.duration)}`}
              style={{
                flex: 1,
                height: `${Math.max((d.plays / maxDailyPlays) * 100, 2)}%`,
                background: d.plays > 0 ? '#60A5FA' : 'rgba(96,165,250,0.15)',
                borderRadius: '2px 2px 0 0',
                minWidth: '3px',
                transition: 'height 0.2s',
              }}
            />
          ))}
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
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid',
              borderColor: activeTab === tab.key ? '#60A5FA' : 'var(--border)',
              background: activeTab === tab.key ? 'rgba(96,165,250,0.1)' : 'transparent',
              color: activeTab === tab.key ? '#60A5FA' : 'var(--muted-foreground)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
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
            <h2>Per-Campaign Stats</h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Client</th>
                    <th>Group</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Plays</th>
                    <th style={{ textAlign: 'right' }}>Screen Time</th>
                    <th style={{ textAlign: 'right' }}>Devices</th>
                    <th style={{ textAlign: 'right' }}>Media</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignStats.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>No campaigns</td></tr>
                  ) : campaignStats.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>{c.clientName}</td>
                      <td>{c.groupName}</td>
                      <td>
                        <span className="status-badge" style={{
                          color: c.status === 'active' ? '#CCF381' : c.status === 'pending_review' ? '#FBBF24' : '#64748B',
                          borderColor: c.status === 'active' ? '#CCF381' : c.status === 'pending_review' ? '#FBBF24' : '#64748B',
                        }}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.plays.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatDuration(c.duration)}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.uniqueDevices}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.mediaCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'devices' && (
          <>
            <h2>Per-Device Stats</h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Device ID</th>
                    <th>Group</th>
                    <th style={{ textAlign: 'right' }}>Total Plays</th>
                    <th style={{ textAlign: 'right' }}>Screen Time</th>
                    <th>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {deviceStats.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>No devices</td></tr>
                  ) : deviceStats.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{d.id}</td>
                      <td>{d.groupName}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.totalPlays.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatDuration(d.totalDuration)}</td>
                      <td style={{ color: 'var(--muted-foreground)' }}>
                        {d.lastSeen !== '—' ? new Date(d.lastSeen).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'groups' && (
          <>
            <h2>Per-Group Stats</h2>
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
                  {groupStats.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>No groups</td></tr>
                  ) : groupStats.map(g => (
                    <tr key={g.id}>
                      <td style={{ fontWeight: 600 }}>{g.name}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{g.deviceCount}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{g.campaignCount}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{g.totalPlays.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatDuration(g.totalDuration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'daily' && (
          <>
            <h2>Daily Breakdown (Last 30 Days)</h2>
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
                  {dailyTrend.slice().reverse().map(d => (
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
