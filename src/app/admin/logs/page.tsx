'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, Play, MapPin, Monitor } from 'lucide-react'
import { useAdminText } from '@/lib/admin-i18n'

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
  const { t, locale } = useAdminText()
  const [tab, setTab] = useState<Tab>('playlogs')
  const [playLogs, setPlayLogs] = useState<PlayLog[]>([])
  const [gpsLogs, setGpsLogs] = useState<GpsLog[]>([])
  const [deviceRecords, setDeviceRecords] = useState<DeviceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [counts, setCounts] = useState({ play: 0, gps: 0, devices: 0 })
  const [now, setNow] = useState(() => Date.now())
  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    try {
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

      const failedRead = [playRes, gpsRes, devRes, playCount, gpsCount, devCount].find(result => result.error)
      if (failedRead) throw failedRead.error

      setPlayLogs(playRes.data || [])
      setGpsLogs(gpsRes.data || [])
      setDeviceRecords(devRes.data || [])
      setCounts({
        play: playCount.count || 0,
        gps: gpsCount.count || 0,
        devices: devCount.count || 0,
      })
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() is async: state is set once the query resolves, not during render
  useEffect(() => { load() }, [])

  // "Last seen" is relative to a clock read that ticks on its own rather than
  // during render, which would make the render impure.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const at = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale, { timeZone: 'Asia/Tbilisi', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
  const mapLink = (lat: number | string, lng: number | string, label: string) => (
    <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer" className="section-link">{label}</a>
  )

  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>{t('Could not load this page from the database. Please try again.')}</p>
        <button type="button" className="portal-btn-primary" onClick={() => void load()}>{t('Try again')}</button>
      </div>
    </div>
  )

  const tabs: { key: Tab; label: string; icon: typeof Play; count: number }[] = [
    { key: 'playlogs', label: t('Plays'), icon: Play, count: counts.play },
    { key: 'gps', label: 'GPS', icon: MapPin, count: counts.gps },
    { key: 'devices', label: t('Devices'), icon: Monitor, count: counts.devices },
  ]

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{t('Logs')}</h1>
          <p className="portal-subtitle">{t('The latest 100 reports per tab, straight from the controllers. Times are Tbilisi time.')}</p>
        </div>
        <button type="button" onClick={load} className="portal-btn-secondary">
          <RefreshCw size={16} aria-hidden /> {t('Refresh')}
        </button>
      </div>

      <div className="table-toolbar">
        <div className="segmented" role="tablist" aria-label={t('Log type')}>
          {tabs.map(item => (
            <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)}>
              <item.icon size={14} aria-hidden style={{ verticalAlign: -2, marginRight: 6 }} />
              {item.label} <span className="cell-sub">{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="portal-loading">{t('Loading…')}</div>
      ) : (
        <div className="campaigns-table-wrapper">
          {tab === 'playlogs' && (
            playLogs.length === 0 ? (
              <div className="portal-empty portal-empty-sm" style={{ boxShadow: 'none' }}>
                <p>{t('No plays reported yet. They appear once a controller starts sending play callbacks.')}</p>
              </div>
            ) : (
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{t('Program')}</th>
                    <th>{t('Device')}</th>
                    <th>{t('Length')}</th>
                    <th>{t('Location')}</th>
                    <th>{t('Played')}</th>
                    <th>{t('Received')}</th>
                  </tr>
                </thead>
                <tbody>
                  {playLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div className="cell-stack">
                          <span style={{ fontWeight: 500 }}>{log.program_name}</span>
                          {!log.campaign_id && <span className="cell-sub" style={{ color: 'var(--portal-warning)' }}>{t('No matching campaign')}</span>}
                        </div>
                      </td>
                      <td><code>{log.device_id}</code></td>
                      <td>{log.duration_seconds}s</td>
                      <td>
                        {log.lat && log.lng && !(log.lat === 0 && log.lng === 0)
                          ? mapLink(log.lat, log.lng, `${Number(log.lat).toFixed(4)}, ${Number(log.lng).toFixed(4)}`)
                          : <span className="cell-sub">—</span>}
                      </td>
                      <td className="cell-nowrap">{at(log.began_at)}</td>
                      <td className="cell-nowrap cell-sub">{at(log.received_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {tab === 'gps' && (
            gpsLogs.length === 0 ? (
              <div className="portal-empty portal-empty-sm" style={{ boxShadow: 'none' }}>
                <p>{t('No GPS reports yet. They appear once a controller starts sending GPS callbacks.')}</p>
              </div>
            ) : (
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{t('Device')}</th>
                    <th>{t('Position')}</th>
                    <th>{t('Speed')}</th>
                    <th>{t('Recorded')}</th>
                  </tr>
                </thead>
                <tbody>
                  {gpsLogs.map((log) => (
                    <tr key={log.id}>
                      <td><code>{log.device_serial}</code></td>
                      <td>{mapLink(log.lat, log.lng, `${Number(log.lat).toFixed(5)}, ${Number(log.lng).toFixed(5)}`)}</td>
                      <td>{t('{n} km/h', { n: Number(log.speed).toFixed(1) })}</td>
                      <td className="cell-nowrap cell-sub">{at(log.recorded_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {tab === 'devices' && (
            deviceRecords.length === 0 ? (
              <div className="portal-empty portal-empty-sm" style={{ boxShadow: 'none' }}>
                <p>{t('No devices registered yet. A device appears here when it first reports in.')}</p>
              </div>
            ) : (
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{t('Device')}</th>
                    <th>{t('Last seen')}</th>
                    <th>{t('Last position')}</th>
                    <th>{t('Registered')}</th>
                  </tr>
                </thead>
                <tbody>
                  {deviceRecords.map((dev) => {
                    const recent = !!dev.last_seen_at && (now - new Date(dev.last_seen_at).getTime()) < 300000
                    return (
                      <tr key={dev.id}>
                        <td>
                          <div className="cell-stack">
                            <span style={{ fontWeight: 500 }}>{dev.name || dev.id}</span>
                            {dev.name && <span className="cell-sub"><code>{dev.id}</code></span>}
                          </div>
                        </td>
                        <td className="cell-nowrap">
                          <span className="device-presence" data-online={recent || undefined} aria-hidden style={{ display: 'inline-block', marginRight: 8, verticalAlign: 1 }} />
                          {at(dev.last_seen_at)}
                        </td>
                        <td>
                          {dev.last_lat && dev.last_lng
                            ? mapLink(dev.last_lat, dev.last_lng, `${Number(dev.last_lat).toFixed(4)}, ${Number(dev.last_lng).toFixed(4)}`)
                            : <span className="cell-sub">—</span>}
                        </td>
                        <td className="cell-nowrap cell-sub">{at(dev.created_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          )}
        </div>
      )}
    </div>
  )
}
