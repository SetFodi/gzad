'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, Play, MapPin, Monitor } from 'lucide-react'

type Tab = 'playlogs' | 'gps' | 'devices'

interface PlayLog {
  id: string
  device_id: string
  campaign_id: string | null
  program_name: string
  program_id: string | null
  play_type: string
  began_at: string
  duration_seconds: number
  lat: number
  lng: number
  received_at: string
}

interface GpsLog {
  id: string
  device_serial: string
  lat: number
  lng: number
  speed: number
  recorded_at: string
}

interface DeviceRecord {
  id: string
  name: string | null
  last_seen_at: string | null
  last_lat: number | null
  last_lng: number | null
  created_at: string
}

export default function LogsPage() {
  const [tab, setTab] = useState<Tab>('playlogs')
  const [playLogs, setPlayLogs] = useState<PlayLog[]>([])
  const [gpsLogs, setGpsLogs] = useState<GpsLog[]>([])
  const [deviceRecords, setDeviceRecords] = useState<DeviceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [counts, setCounts] = useState({ play: 0, gps: 0, devices: 0 })
  const supabase = createClient()

  const load = async () => {
    setLoading(true)

    // Load all three in parallel
    const [playRes, gpsRes, devRes, playCount, gpsCount, devCount] = await Promise.all([
      supabase
        .from('play_logs')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(100),
      supabase
        .from('gps_logs')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(100),
      supabase
        .from('devices')
        .select('*')
        .order('last_seen_at', { ascending: false }),
      supabase.from('play_logs').select('*', { count: 'exact', head: true }),
      supabase.from('gps_logs').select('*', { count: 'exact', head: true }),
      supabase.from('devices').select('*', { count: 'exact', head: true }),
    ])

    setPlayLogs(playRes.data || [])
    setGpsLogs(gpsRes.data || [])
    setDeviceRecords(devRes.data || [])
    setCounts({
      play: playCount.count || 0,
      gps: gpsCount.count || 0,
      devices: devCount.count || 0,
    })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return '—'
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  const tabStyle = (t: Tab) => ({
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer' as const,
    borderRadius: 8,
    border: 'none',
    background: tab === t ? 'rgba(96,165,250,0.15)' : 'transparent',
    color: tab === t ? '#60A5FA' : '#71717a',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  })

  const thStyle = {
    textAlign: 'left' as const,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: '#71717a',
    borderBottom: '1px solid #1a1a1a',
    whiteSpace: 'nowrap' as const,
  }

  const tdStyle = {
    padding: '8px 12px',
    fontSize: 13,
    color: '#d4d4d8',
    borderBottom: '1px solid #0f0f0f',
    whiteSpace: 'nowrap' as const,
  }

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <h1 className="portal-page-title">Logs</h1>
        <button onClick={load} className="portal-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <button onClick={() => setTab('playlogs')} style={tabStyle('playlogs')}>
          <Play size={16} /> Play Logs ({counts.play})
        </button>
        <button onClick={() => setTab('gps')} style={tabStyle('gps')}>
          <MapPin size={16} /> GPS Logs ({counts.gps})
        </button>
        <button onClick={() => setTab('devices')} style={tabStyle('devices')}>
          <Monitor size={16} /> Devices ({counts.devices})
        </button>
      </div>

      {loading ? (
        <div className="portal-loading">Loading...</div>
      ) : (
        <div style={{
          background: '#0A0A0A',
          border: '1px solid #1A1A1A',
          borderRadius: 12,
          overflow: 'auto',
        }}>
          {/* Play Logs Tab */}
          {tab === 'playlogs' && (
            playLogs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#525252' }}>
                <Play size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p>No play logs yet.</p>
                <p style={{ fontSize: 13 }}>Logs will appear once the controller starts reporting plays via callbacks.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Program</th>
                    <th style={thStyle}>Device</th>
                    <th style={thStyle}>Duration</th>
                    <th style={thStyle}>Location</th>
                    <th style={thStyle}>Played At</th>
                    <th style={thStyle}>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {playLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={tdStyle}>
                        <span style={{ color: log.campaign_id ? '#CCF381' : '#71717a' }}>
                          {log.program_name}
                        </span>
                        {!log.campaign_id && (
                          <span style={{ fontSize: 11, color: '#525252', marginLeft: 6 }}>unmatched</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12, fontFamily: 'monospace' }}>{log.device_id}</td>
                      <td style={tdStyle}>{log.duration_seconds}s</td>
                      <td style={tdStyle}>
                        {log.lat && log.lng && !(log.lat === 0 && log.lng === 0) ? (
                          <a
                            href={`https://www.google.com/maps?q=${log.lat},${log.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#60A5FA', textDecoration: 'none', fontSize: 12 }}
                          >
                            {Number(log.lat).toFixed(4)}, {Number(log.lng).toFixed(4)}
                          </a>
                        ) : (
                          <span style={{ color: '#3f3f46' }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>{new Date(log.began_at).toLocaleString()}</td>
                      <td style={{ ...tdStyle, color: '#71717a' }}>{timeAgo(log.received_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* GPS Logs Tab */}
          {tab === 'gps' && (
            gpsLogs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#525252' }}>
                <MapPin size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p>No GPS logs yet.</p>
                <p style={{ fontSize: 13 }}>GPS data will appear once the controller starts reporting via callbacks.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Device</th>
                    <th style={thStyle}>Latitude</th>
                    <th style={thStyle}>Longitude</th>
                    <th style={thStyle}>Speed</th>
                    <th style={thStyle}>Map</th>
                    <th style={thStyle}>Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {gpsLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ ...tdStyle, fontSize: 12, fontFamily: 'monospace' }}>{log.device_serial}</td>
                      <td style={tdStyle}>{Number(log.lat).toFixed(6)}</td>
                      <td style={tdStyle}>{Number(log.lng).toFixed(6)}</td>
                      <td style={tdStyle}>{Number(log.speed).toFixed(1)} km/h</td>
                      <td style={tdStyle}>
                        <a
                          href={`https://www.google.com/maps?q=${log.lat},${log.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#60A5FA', textDecoration: 'none', fontSize: 12 }}
                        >
                          Open
                        </a>
                      </td>
                      <td style={{ ...tdStyle, color: '#71717a' }}>{timeAgo(log.recorded_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* Devices Tab */}
          {tab === 'devices' && (
            deviceRecords.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#525252' }}>
                <Monitor size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p>No devices registered yet.</p>
                <p style={{ fontSize: 13 }}>Devices appear here when callbacks report data.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Device ID</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Last Seen</th>
                    <th style={thStyle}>Last Position</th>
                    <th style={thStyle}>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {deviceRecords.map((dev) => (
                    <tr key={dev.id}>
                      <td style={{ ...tdStyle, fontSize: 12, fontFamily: 'monospace' }}>{dev.id}</td>
                      <td style={tdStyle}>{dev.name || '—'}</td>
                      <td style={tdStyle}>
                        <span style={{
                          color: dev.last_seen_at && (Date.now() - new Date(dev.last_seen_at).getTime()) < 300000
                            ? '#CCF381'
                            : '#71717a',
                        }}>
                          {timeAgo(dev.last_seen_at)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {dev.last_lat && dev.last_lng ? (
                          <a
                            href={`https://www.google.com/maps?q=${dev.last_lat},${dev.last_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#60A5FA', textDecoration: 'none', fontSize: 12 }}
                          >
                            {Number(dev.last_lat).toFixed(4)}, {Number(dev.last_lng).toFixed(4)}
                          </a>
                        ) : (
                          <span style={{ color: '#3f3f46' }}>—</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: '#71717a' }}>{timeAgo(dev.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      )}

      <div style={{ marginTop: 12, color: '#3f3f46', fontSize: 12 }}>
        Showing latest 100 entries per tab. Data comes from controller callbacks.
      </div>
    </div>
  )
}
