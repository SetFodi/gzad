'use client'

import { useEffect, useState, useCallback } from 'react'
import { Monitor, RefreshCw, Sun, Power, Send, Settings, Camera, Volume2, Trash2, Play, Clock, RotateCcw, HardDrive, MapPin, Search, Signal, Thermometer, Zap, Droplets } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import StatusBadge from '@/components/app/StatusBadge'

interface Device {
  cardId: string
  name: string | null
  online: boolean
  connectedAt: string | null
  lastSeen: string | null
  info: Record<string, unknown>
  registered: boolean
}

interface DeviceHealth {
  screenOn?: boolean
  temperature?: number
  voltage?: number
  humidity?: number
  signalStrength?: number
  signalType?: string
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<{ ok: boolean; msg: string; data?: string } | null>(null)
  const [brightness, setBrightness] = useState(100)
  const [volume, setVolume] = useState(8)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [playingInfo, setPlayingInfo] = useState<string | null>(null)
  const [schedBrightness, setSchedBrightness] = useState({ time: '08:00', value: 100 })
  const [deviceHealth, setDeviceHealth] = useState<Record<string, DeviceHealth>>({})
  const [healthLoading, setHealthLoading] = useState(false)

  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/devices')
      const data = await res.json()
      if (!res.ok) throw new Error('Failed to load devices')
      setLoadError(false)
      if (Array.isArray(data.devices)) {
        setDevices(data.devices)
        setError(data.realtimeError || '')
      } else if (Array.isArray(data)) {
        setDevices(data)
        setError('')
      } else {
        throw new Error('Invalid device response')
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchHealthData = useCallback(async (deviceList: Device[]) => {
    const onlineDevices = deviceList.filter(d => d.online)
    if (onlineDevices.length === 0) return

    setHealthLoading(true)
    const healthMap: Record<string, DeviceHealth> = {}

    await Promise.all(onlineDevices.map(async (d) => {
      const health: DeviceHealth = {}

      // Query screen status
      try {
        const res = await fetch('/api/devices/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardId: d.cardId, action: 'is-screen-on' }),
        })
        const data = await res.json()
        if (res.ok) {
          health.screenOn = data.result === true || data.result === 'true'
        }
      } catch { /* ignore */ }

      // Query device info for temp/voltage/humidity
      try {
        const res = await fetch('/api/devices/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardId: d.cardId, action: 'info' }),
        })
        const data = await res.json()
        if (res.ok) {
          const info = data.result || data
          health.temperature = parseFloat(info.temperature) || parseFloat(info.temp) || undefined
          health.voltage = parseFloat(info.voltage) || undefined
          health.humidity = parseFloat(info.humidity) || undefined
        }
      } catch { /* ignore */ }

      // Query SIM/signal info
      try {
        const res = await fetch('/api/devices/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardId: d.cardId, action: 'get-sim-info' }),
        })
        const data = await res.json()
        if (res.ok) {
          const info = data.result || data
          health.signalStrength = parseInt(info.signalStrength || info.rssi || info.signal) || undefined
          health.signalType = info.networkType || info.type || undefined
        }
      } catch { /* ignore */ }

      healthMap[d.cardId] = health
    }))

    setDeviceHealth(healthMap)
    setHealthLoading(false)
  }, [])

  useEffect(() => {
    loadDevices()
    const interval = setInterval(loadDevices, 10000)
    return () => clearInterval(interval)
  }, [loadDevices])

  // Fetch health data once when devices first load
  useEffect(() => {
    if (devices.length > 0 && Object.keys(deviceHealth).length === 0 && !healthLoading) {
      fetchHealthData(devices)
    }
  }, [devices, deviceHealth, healthLoading, fetchHealthData])

  const sendAction = async (cardId: string, action: string, params: Record<string, unknown> = {}) => {
    setActionLoading(`${cardId}-${action}`)
    setActionResult(null)
    try {
      const res = await fetch('/api/devices/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, action, ...params }),
      })
      const data = await res.json()
      if (res.ok) {
        const detail = data.result !== undefined
          ? (typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2))
          : (data.success ? 'Done' : JSON.stringify(data, null, 2))
        setActionResult({ ok: true, msg: `${action}: Success`, data: detail })
      } else {
        setActionResult({ ok: false, msg: `${action}: ${data.error || 'Failed'}` })
      }
    } catch {
      setActionResult({ ok: false, msg: `${action}: Failed to connect` })
    } finally {
      setActionLoading(null)
    }
  }

  const takeScreenshot = async (cardId: string) => {
    setActionLoading(`${cardId}-screenshot`)
    setScreenshotUrl(null)
    setActionResult(null)
    try {
      const res = await fetch('/api/devices/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, action: 'screenshot', quality: 80, scale: 50 }),
      })
      const data = await res.json()
      if (res.ok) {
        const imgData = typeof data.result === 'string' && data.result.startsWith('/9j/')
          ? data.result
          : data.result?.screenshot || data.result?.data || data.result?.img || null

        if (imgData) {
          const cleanBase64 = imgData.replace(/\n/g, '')
          setScreenshotUrl(`data:image/png;base64,${cleanBase64}`)
          setActionResult({ ok: true, msg: 'Screenshot captured' })
        } else {
          setActionResult({ ok: false, msg: 'Screenshot: No image data', data: JSON.stringify(data, null, 2) })
        }
      } else {
        setActionResult({ ok: false, msg: `Screenshot: ${data.error || 'Failed'}` })
      }
    } catch (err) {
      setActionResult({ ok: false, msg: `Screenshot: ${err instanceof Error ? err.message : 'Failed'}` })
    } finally {
      setActionLoading(null)
    }
  }

  const checkPlaying = async (cardId: string) => {
    setActionLoading(`${cardId}-get-playing`)
    setPlayingInfo(null)
    try {
      const res = await fetch('/api/devices/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, action: 'get-playing' }),
      })
      const data = await res.json()
      if (res.ok) {
        const name = data.name || data.result?.name || data.programName
        setPlayingInfo(name || JSON.stringify(data))
      } else {
        setPlayingInfo(data.error || 'No program playing')
      }
    } catch {
      setPlayingInfo('Failed to connect')
    } finally {
      setActionLoading(null)
    }
  }

  const getGpsLocation = async (cardId: string) => {
    setActionLoading(`${cardId}-get-gps`)
    setActionResult(null)
    try {
      // Query the device live via realtime server
      const res = await fetch('/api/devices/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, action: 'get-gps' }),
      })
      const data = await res.json()
      const lat = data?.lat || data?.latitude || data?.result?.lat || data?.result?.latitude
      const lng = data?.lng || data?.longitude || data?.result?.lng || data?.result?.longitude

      if (lat && lng && (lat !== 0 || lng !== 0)) {
        setActionResult({
          ok: true,
          msg: `Live GPS Location`,
          data: `Lat: ${lat}, Lng: ${lng}${data?.speed ? `, Speed: ${data.speed} km/h` : ''}\nhttps://www.google.com/maps?q=${lat},${lng}`,
        })
      } else {
        // Fallback to DB
        const supabase = createClient()
        const { data: device } = await supabase
          .from('devices')
          .select('last_lat, last_lng, last_seen_at')
          .eq('id', cardId)
          .single()

        if (device?.last_lat && device?.last_lng) {
          setActionResult({
            ok: true,
            msg: `Last Known Location (${device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'unknown time'})`,
            data: `Lat: ${device.last_lat}, Lng: ${device.last_lng}\nhttps://www.google.com/maps?q=${device.last_lat},${device.last_lng}`,
          })
        } else {
          setActionResult({ ok: false, msg: 'GPS: No location data available' })
        }
      }
    } catch {
      setActionResult({ ok: false, msg: 'GPS: Failed to fetch location' })
    } finally {
      setActionLoading(null)
    }
  }

  const cleanStorage = async (cardId: string) => {
    if (!confirm('Clean device storage? This will clear all cached programs. You\'ll need to re-push active ads.')) return
    setActionLoading(`${cardId}-clean-storage`)
    setActionResult(null)
    try {
      const res = await fetch('/api/devices/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, action: 'clean-storage' }),
      })
      const data = await res.json()
      if (res.ok) {
        const diskInfo = data.diskSpace?.result || data.diskSpace || {}
        const freeStr = diskInfo.free ? `${Math.round(diskInfo.free / 1024 / 1024)}MB free` : ''
        setActionResult({
          ok: true,
          msg: `Storage cleaned${freeStr ? ` — ${freeStr}` : ''}`,
          data: JSON.stringify(data, null, 2),
        })
      } else {
        setActionResult({ ok: false, msg: `Clean storage: ${data.error || 'Failed'}` })
      }
    } catch {
      setActionResult({ ok: false, msg: 'Clean storage: Failed to connect' })
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return <div className="portal-loading">Loading…</div>

  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>Could not load devices from the database. Please try again.</p>
        <button type="button" className="portal-btn-primary" onClick={() => void loadDevices()}>Try again</button>
      </div>
    </div>
  )

  const onlineCount = devices.filter(d => d.online).length
  const busy = !!actionLoading
  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Tbilisi', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">Devices</h1>
          <p className="portal-subtitle">
            {error ? 'Live status unavailable' : `${onlineCount} of ${devices.length} ${devices.length === 1 ? 'screen' : 'screens'} online`} · refreshes every 10 seconds
          </p>
        </div>
        <div className="admin-header-actions">
          <button
            type="button"
            onClick={() => { setDeviceHealth({}); fetchHealthData(devices) }}
            disabled={healthLoading}
            className="portal-btn-secondary"
          >
            <Thermometer size={16} aria-hidden /> {healthLoading ? 'Checking…' : 'Health check'}
          </button>
          <button type="button" onClick={loadDevices} className="portal-btn-secondary">
            <RefreshCw size={16} aria-hidden /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="portal-alert portal-alert-warning">
          <strong>Can&apos;t reach the Realtime Server</strong> ({error}). Showing registered screens; live status and controls come back once it&apos;s reachable.
        </div>
      )}

      {actionResult && (
        <div className={`portal-alert ${actionResult.ok ? 'portal-alert-success' : 'portal-alert-danger'} alert-dismissible`} role="status">
          <div>
            <div style={{ fontWeight: 600 }}>{actionResult.msg}</div>
            {actionResult.data && <pre className="alert-pre">{actionResult.data}</pre>}
          </div>
          <button type="button" className="app-icon-btn" onClick={() => setActionResult(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {devices.length === 0 && !error ? (
        <div className="portal-empty">
          <p>No devices registered yet.</p>
          <p style={{ fontSize: 14 }}>
            Add one to the <code>devices</code> table, or connect a controller to the Realtime Server.
          </p>
        </div>
      ) : (
        <div className="device-list">
          {devices.map((d) => {
            const health = deviceHealth[d.cardId]
            const named = d.name && d.name !== d.cardId
            const chips: { icon: typeof Sun; label: string; tone?: string }[] = []
            if (d.online && health) {
              if (health.screenOn !== undefined) chips.push({ icon: Power, label: health.screenOn ? 'Screen on' : 'Screen off', tone: health.screenOn ? 'var(--portal-success)' : undefined })
              if (health.temperature !== undefined) chips.push({ icon: Thermometer, label: `${health.temperature.toFixed(1)}°C` })
              if (health.voltage !== undefined) chips.push({ icon: Zap, label: `${health.voltage.toFixed(1)} V` })
              if (health.humidity !== undefined) chips.push({ icon: Droplets, label: `${health.humidity.toFixed(0)}%` })
              if (health.signalStrength !== undefined) chips.push({
                icon: Signal,
                label: `${health.signalStrength} dBm${health.signalType ? ` · ${health.signalType}` : ''}`,
                tone: health.signalStrength > -80 ? 'var(--portal-success)' : health.signalStrength > -100 ? 'var(--portal-warning)' : 'var(--portal-danger)',
              })
            }

            return (
              <article key={d.cardId} className="device-card" data-online={d.online || undefined}>
                <header className="device-card-head">
                  <span className="device-presence" aria-hidden />
                  <div className="cell-stack" style={{ flex: 1 }}>
                    <h3 className="device-name">
                      <Monitor size={16} aria-hidden />
                      {named ? d.name : d.cardId}
                    </h3>
                    <span className="cell-sub">
                      {named && <code>{d.cardId}</code>} {d.online
                        ? `Connected ${when(d.connectedAt) ?? '—'}`
                        : d.lastSeen ? `Last seen ${when(d.lastSeen)}` : 'Never connected'}
                    </span>
                  </div>
                  <StatusBadge status={error ? 'unknown' : d.online ? 'online' : 'offline'}>{error ? 'Unknown' : d.online ? 'Online' : 'Offline'}</StatusBadge>
                </header>

                {chips.length > 0 && (
                  <div className="device-chips">
                    {chips.map(c => (
                      <span key={c.label} className="portal-chip" style={c.tone ? { color: c.tone } : undefined}>
                        <c.icon size={12} aria-hidden /> {c.label}
                      </span>
                    ))}
                  </div>
                )}

                {!d.online ? (
                  <p className="device-offline">
                    {error ? 'Live status is unavailable. Controls return when the Realtime Server is reachable.' : 'The screen is off or not connected to the Realtime Server. Controls appear when it comes back online.'}
                  </p>
                ) : (
                  <>
                    <div className="device-actions">
                      <button
                        type="button"
                        className="action-btn"
                        aria-pressed={health?.screenOn === true}
                        disabled={busy}
                        onClick={async () => {
                          await sendAction(d.cardId, 'screen', { on: true })
                          setDeviceHealth(prev => ({ ...prev, [d.cardId]: { ...prev[d.cardId], screenOn: true } }))
                        }}
                      >
                        <Power size={14} aria-hidden /> Screen on
                      </button>
                      <button
                        type="button"
                        className="action-btn"
                        aria-pressed={health?.screenOn === false}
                        disabled={busy}
                        onClick={async () => {
                          await sendAction(d.cardId, 'screen', { on: false })
                          setDeviceHealth(prev => ({ ...prev, [d.cardId]: { ...prev[d.cardId], screenOn: false } }))
                        }}
                      >
                        <Power size={14} aria-hidden /> Screen off
                      </button>
                      <button type="button" className="action-btn" onClick={() => takeScreenshot(d.cardId)} disabled={busy}>
                        <Camera size={14} aria-hidden /> Screenshot
                      </button>
                      <button type="button" className="action-btn" onClick={() => checkPlaying(d.cardId)} disabled={busy}>
                        <Play size={14} aria-hidden /> Now playing
                      </button>
                      <button type="button" className="action-btn" onClick={() => getGpsLocation(d.cardId)} disabled={busy}>
                        <MapPin size={14} aria-hidden /> Locate
                      </button>
                    </div>

                    <div className="device-sliders">
                      <div className="device-slider">
                        <Sun size={16} aria-hidden />
                        <span className="device-slider-label">Brightness</span>
                        <input type="range" aria-label="Brightness" min={1} max={255} value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value))} />
                        <output>{brightness}</output>
                        <button type="button" className="action-btn" onClick={() => sendAction(d.cardId, 'brightness', { brightness })} disabled={actionLoading === `${d.cardId}-brightness`}>Set</button>
                      </div>
                      <div className="device-slider">
                        <Volume2 size={16} aria-hidden />
                        <span className="device-slider-label">Volume</span>
                        <input type="range" aria-label="Volume" min={0} max={15} value={volume} onChange={(e) => setVolume(parseInt(e.target.value))} />
                        <output>{volume}</output>
                        <button type="button" className="action-btn" onClick={() => sendAction(d.cardId, 'volume', { volume })} disabled={actionLoading === `${d.cardId}-volume`}>Set</button>
                      </div>
                    </div>

                    {playingInfo && (
                      <div className="portal-alert" style={{ margin: 0 }}>
                        <strong>Now playing:</strong> {playingInfo}
                      </div>
                    )}

                    {screenshotUrl && (
                      <figure className="device-screenshot">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={screenshotUrl} alt="What the screen is showing" />
                        <figcaption className="cell-sub">Live screenshot</figcaption>
                      </figure>
                    )}

                    <details className="device-more">
                      <summary>Advanced</summary>
                      <div className="device-more-body">
                        <div className="device-group">
                          <p className="device-group-title">Setup</p>
                          <div className="device-actions">
                            <button type="button" className="action-btn" onClick={() => sendAction(d.cardId, 'setup-callbacks')} disabled={busy}>
                              <Send size={14} aria-hidden /> Set up callbacks
                            </button>
                            <button type="button" className="action-btn" onClick={() => sendAction(d.cardId, 'info')} disabled={busy}>
                              <Settings size={14} aria-hidden /> Device info
                            </button>
                          </div>
                        </div>

                        <div className="device-group">
                          <p className="device-group-title"><Search size={12} aria-hidden /> Read device state</p>
                          <div className="device-actions">
                            <button type="button" className="action-btn" onClick={() => sendAction(d.cardId, 'get-brightness')} disabled={busy}>Brightness</button>
                            <button type="button" className="action-btn" onClick={() => sendAction(d.cardId, 'is-screen-on')} disabled={busy}>Screen status</button>
                            <button type="button" className="action-btn" onClick={() => sendAction(d.cardId, 'get-disk-space')} disabled={busy}>
                              <HardDrive size={12} aria-hidden /> Disk space
                            </button>
                            <button type="button" className="action-btn" onClick={() => sendAction(d.cardId, 'get-upload-log-url')} disabled={busy}>Play-log config</button>
                            <button type="button" className="action-btn" onClick={() => sendAction(d.cardId, 'get-sub-gps')} disabled={busy}>GPS config</button>
                            <button type="button" className="action-btn" onClick={() => sendAction(d.cardId, 'get-sim-info')} disabled={busy}>
                              <Signal size={12} aria-hidden /> SIM info
                            </button>
                          </div>
                        </div>

                        <div className="device-group">
                          <p className="device-group-title"><Clock size={12} aria-hidden /> Scheduled brightness</p>
                          <div className="device-actions">
                            <input
                              type="time"
                              className="input-sm"
                              value={schedBrightness.time}
                              onChange={(e) => setSchedBrightness({ ...schedBrightness, time: e.target.value })}
                              aria-label="Time"
                            />
                            <span className="cell-sub">set brightness to</span>
                            <input
                              type="number"
                              className="input-sm"
                              min={1}
                              max={255}
                              value={schedBrightness.value}
                              onChange={(e) => setSchedBrightness({ ...schedBrightness, value: parseInt(e.target.value) || 1 })}
                              aria-label="Brightness"
                              style={{ width: 80 }}
                            />
                            <button
                              type="button"
                              className="action-btn"
                              onClick={() => sendAction(d.cardId, 'scheduled-brightness', {
                                items: [{ time: schedBrightness.time, brightness: schedBrightness.value }],
                              })}
                              disabled={busy}
                            >
                              Save
                            </button>
                          </div>
                        </div>

                        <div className="device-group device-danger">
                          <p className="device-group-title">Danger zone</p>
                          <div className="device-actions">
                            <button
                              type="button"
                              className="action-btn reject"
                              onClick={() => {
                                if (confirm('Clear the program on this screen? It stops showing ads until playlists are pushed again.')) {
                                  sendAction(d.cardId, 'clear-program')
                                }
                              }}
                              disabled={busy}
                            >
                              <Trash2 size={14} aria-hidden /> Clear program
                            </button>
                            <button type="button" className="action-btn reject" onClick={() => cleanStorage(d.cardId)} disabled={busy}>
                              <HardDrive size={14} aria-hidden /> Clean storage
                            </button>
                            <button
                              type="button"
                              className="action-btn reject"
                              onClick={() => {
                                if (confirm('Reboot this device? It will disconnect for about 30 seconds.')) {
                                  sendAction(d.cardId, 'reboot')
                                }
                              }}
                              disabled={busy}
                            >
                              <RotateCcw size={14} aria-hidden /> Reboot
                            </button>
                          </div>
                        </div>
                      </div>
                    </details>
                  </>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
