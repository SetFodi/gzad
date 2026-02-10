'use client'

import { useEffect, useState, useCallback } from 'react'
import { Monitor, Wifi, WifiOff, RefreshCw, Sun, Power, Send, Settings, Camera, Volume2, Trash2, Play, Clock, RotateCcw, HardDrive, MapPin, Search, Signal, Thermometer, Zap, Droplets } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
      if (data.devices) {
        setDevices(data.devices)
        setError(data.realtimeError || '')
      } else if (Array.isArray(data)) {
        setDevices(data)
        setError('')
      } else {
        setError(data.error || 'Failed to load devices')
      }
    } catch {
      setError('Cannot reach server')
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
        setActionResult({ ok: false, msg: 'GPS: No location data yet — wait for GPS callbacks to report' })
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

  const btnStyle = { padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 } as const

  if (loading) return <div className="portal-loading">Loading...</div>

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <h1 className="portal-page-title">Devices</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setDeviceHealth({}); fetchHealthData(devices) }}
            disabled={healthLoading}
            className="portal-btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Thermometer size={16} /> {healthLoading ? 'Loading...' : 'Health Check'}
          </button>
          <button onClick={loadDevices} className="portal-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          marginBottom: '1rem', padding: '10px 14px', borderRadius: 8,
          background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
          color: '#FBBF24', fontSize: 13,
        }}>
          {error}. Showing registered devices — online status unavailable until Realtime Server is reachable.
        </div>
      )}

      {actionResult && (
        <div style={{
          marginBottom: '1rem',
          padding: '10px 14px',
          borderRadius: 8,
          background: actionResult.ok ? 'rgba(204,243,129,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${actionResult.ok ? 'rgba(204,243,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          color: actionResult.ok ? '#CCF381' : '#EF4444',
          fontSize: 13,
        }}>
          <div style={{ fontWeight: 600, marginBottom: actionResult.data ? 6 : 0 }}>{actionResult.msg}</div>
          {actionResult.data && (
            <pre style={{
              margin: 0,
              fontSize: 11,
              color: '#a1a1aa',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxHeight: 200,
              overflow: 'auto',
            }}>
              {actionResult.data}
            </pre>
          )}
        </div>
      )}

      {devices.length === 0 && !error ? (
        <div className="portal-empty">
          <Monitor size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <p>No devices registered.</p>
          <p style={{ color: '#525252', fontSize: 14 }}>
            Register a device in the <code>devices</code> table or connect a controller to the Realtime Server.
          </p>
        </div>
      ) : (
        <div className="campaigns-grid">
          {devices.map((d) => {
            const health = deviceHealth[d.cardId]
            return (
              <div key={d.cardId} className="campaign-card" style={{ cursor: 'default' }}>
                <div className="campaign-card-header">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Monitor size={18} />
                    <span>
                      {d.name && d.name !== d.cardId ? d.name : d.cardId}
                      {d.name && d.name !== d.cardId && (
                        <span style={{ fontSize: 11, color: '#71717a', fontWeight: 400, marginLeft: 6 }}>{d.cardId}</span>
                      )}
                    </span>
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Screen Power Indicator */}
                    {d.online && health && health.screenOn !== undefined && (
                      <span title={health.screenOn ? 'Screen ON' : 'Screen OFF'} style={{
                        width: 10, height: 10, borderRadius: '50%', display: 'inline-block',
                        background: health.screenOn ? '#CCF381' : '#71717a',
                        boxShadow: health.screenOn ? '0 0 6px rgba(204,243,129,0.5)' : 'none',
                      }} />
                    )}
                    <span className="status-badge" style={{
                      color: d.online ? '#CCF381' : '#EF4444',
                      borderColor: d.online ? '#CCF381' : '#EF4444',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {d.online ? <Wifi size={14} /> : <WifiOff size={14} />}
                      {d.online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>

                <div className="campaign-card-details">
                  {d.online ? (
                    <>
                      <div>
                        <span className="detail-label">Connected</span>
                        <span>{d.connectedAt ? new Date(d.connectedAt).toLocaleString() : '—'}</span>
                      </div>
                      <div>
                        <span className="detail-label">Last Seen</span>
                        <span>{d.lastSeen ? new Date(d.lastSeen).toLocaleString() : '—'}</span>
                      </div>
                    </>
                  ) : (
                    <div>
                      <span className="detail-label">Last Seen</span>
                      <span>{d.lastSeen ? new Date(d.lastSeen).toLocaleString() : 'Never connected'}</span>
                    </div>
                  )}
                </div>

                {/* Offline message */}
                {!d.online && (
                  <div style={{
                    marginTop: 12, padding: '12px 14px', borderRadius: 8,
                    background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)',
                    color: '#a1a1aa', fontSize: 13,
                  }}>
                    Device is powered off or not connected to the Realtime Server. Controls will appear when it comes online.
                  </div>
                )}

                {/* Device Health Stats */}
                {d.online && health && (health.temperature !== undefined || health.voltage !== undefined || health.signalStrength !== undefined) && (
                  <div style={{
                    display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12,
                    padding: '10px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid #1a1a1a',
                  }}>
                    {health.temperature !== undefined && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        <Thermometer size={14} style={{ color: '#FBBF24' }} />
                        <span style={{ color: '#e4e4e7' }}>{health.temperature.toFixed(1)}°C</span>
                      </div>
                    )}
                    {health.voltage !== undefined && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        <Zap size={14} style={{ color: '#60A5FA' }} />
                        <span style={{ color: '#e4e4e7' }}>{health.voltage.toFixed(1)}V</span>
                      </div>
                    )}
                    {health.humidity !== undefined && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        <Droplets size={14} style={{ color: '#38BDF8' }} />
                        <span style={{ color: '#e4e4e7' }}>{health.humidity.toFixed(0)}%</span>
                      </div>
                    )}
                    {health.signalStrength !== undefined && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        <Signal size={14} style={{ color: health.signalStrength > -80 ? '#CCF381' : health.signalStrength > -100 ? '#FBBF24' : '#EF4444' }} />
                        <span style={{ color: '#e4e4e7' }}>
                          {health.signalStrength} dBm
                          {health.signalType ? ` (${health.signalType})` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {d.online && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Brightness Control */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sun size={16} style={{ color: '#FBBF24', flexShrink: 0 }} />
                      <input
                        type="range"
                        min={1}
                        max={255}
                        value={brightness}
                        onChange={(e) => setBrightness(parseInt(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <span style={{ color: '#A3A3A3', fontSize: 12, width: 30, textAlign: 'right' }}>{brightness}</span>
                      <button
                        onClick={() => sendAction(d.cardId, 'brightness', { brightness })}
                        disabled={actionLoading === `${d.cardId}-brightness`}
                        className="portal-btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        Set
                      </button>
                    </div>

                    {/* Volume Control */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Volume2 size={16} style={{ color: '#60A5FA', flexShrink: 0 }} />
                      <input
                        type="range"
                        min={0}
                        max={15}
                        value={volume}
                        onChange={(e) => setVolume(parseInt(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <span style={{ color: '#A3A3A3', fontSize: 12, width: 20, textAlign: 'right' }}>{volume}</span>
                      <button
                        onClick={() => sendAction(d.cardId, 'volume', { volume })}
                        disabled={actionLoading === `${d.cardId}-volume`}
                        className="portal-btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        Set
                      </button>
                    </div>

                    {/* Row 1: Core Controls */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={async () => {
                          await sendAction(d.cardId, 'screen', { on: true })
                          setDeviceHealth(prev => ({ ...prev, [d.cardId]: { ...prev[d.cardId], screenOn: true } }))
                        }}
                        disabled={!!actionLoading}
                        style={{
                          ...btnStyle,
                          border: `1px solid ${health?.screenOn === true ? 'rgba(204,243,129,0.4)' : '#27272a'}`,
                          background: health?.screenOn === true ? 'rgba(204,243,129,0.12)' : 'rgba(255,255,255,0.05)',
                          color: health?.screenOn === true ? '#CCF381' : '#e4e4e7',
                          cursor: 'pointer', borderRadius: 8, fontWeight: 500,
                        }}
                      >
                        <Power size={14} /> Screen On
                      </button>
                      <button
                        onClick={async () => {
                          await sendAction(d.cardId, 'screen', { on: false })
                          setDeviceHealth(prev => ({ ...prev, [d.cardId]: { ...prev[d.cardId], screenOn: false } }))
                        }}
                        disabled={!!actionLoading}
                        style={{
                          ...btnStyle,
                          border: `1px solid ${health?.screenOn === false ? 'rgba(239,68,68,0.4)' : '#27272a'}`,
                          background: health?.screenOn === false ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)',
                          color: health?.screenOn === false ? '#EF4444' : '#e4e4e7',
                          cursor: 'pointer', borderRadius: 8, fontWeight: 500,
                        }}
                      >
                        <Power size={14} /> Screen Off
                      </button>
                      <button onClick={() => takeScreenshot(d.cardId)} disabled={!!actionLoading} className="portal-btn-secondary" style={btnStyle}>
                        <Camera size={14} /> Screenshot
                      </button>
                      <button onClick={() => sendAction(d.cardId, 'info')} disabled={!!actionLoading} className="portal-btn-secondary" style={btnStyle}>
                        <Settings size={14} /> Get Info
                      </button>
                    </div>

                    {/* Row 2: Callbacks & Program */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => sendAction(d.cardId, 'setup-callbacks')} disabled={!!actionLoading} className="portal-btn-secondary" style={btnStyle}>
                        <Send size={14} /> Setup Callbacks
                      </button>
                      <button onClick={() => checkPlaying(d.cardId)} disabled={!!actionLoading} className="portal-btn-secondary" style={btnStyle}>
                        <Play size={14} /> Check Playing
                      </button>
                      <button onClick={() => getGpsLocation(d.cardId)} disabled={!!actionLoading} className="portal-btn-secondary" style={btnStyle}>
                        <MapPin size={14} /> Where Is It?
                      </button>
                      <button
                        onClick={() => sendAction(d.cardId, 'clear-program')}
                        disabled={!!actionLoading}
                        style={{
                          ...btnStyle,
                          border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
                          color: '#EF4444', cursor: 'pointer', borderRadius: 8, fontWeight: 500,
                        }}
                      >
                        <Trash2 size={14} /> Clear Program
                      </button>
                    </div>

                    {/* Row 3: Query Buttons */}
                    <div style={{
                      background: 'rgba(255,255,255,0.03)', border: '1px solid #1a1a1a',
                      borderRadius: 8, padding: '10px 14px',
                    }}>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Search size={12} /> Query Device State
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => sendAction(d.cardId, 'get-brightness')} disabled={!!actionLoading} className="portal-btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>
                          Brightness
                        </button>
                        <button onClick={() => sendAction(d.cardId, 'is-screen-on')} disabled={!!actionLoading} className="portal-btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>
                          Screen Status
                        </button>
                        <button onClick={() => sendAction(d.cardId, 'get-disk-space')} disabled={!!actionLoading} className="portal-btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>
                          <HardDrive size={12} /> Disk Space
                        </button>
                        <button onClick={() => sendAction(d.cardId, 'get-upload-log-url')} disabled={!!actionLoading} className="portal-btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>
                          PlayLog Config
                        </button>
                        <button onClick={() => sendAction(d.cardId, 'get-sub-gps')} disabled={!!actionLoading} className="portal-btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>
                          GPS Config
                        </button>
                        <button onClick={() => sendAction(d.cardId, 'get-sim-info')} disabled={!!actionLoading} className="portal-btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>
                          <Signal size={12} /> SIM Info
                        </button>
                      </div>
                    </div>

                    {/* Scheduled Brightness */}
                    <div style={{
                      background: 'rgba(255,255,255,0.03)', border: '1px solid #1a1a1a',
                      borderRadius: 8, padding: '10px 14px',
                    }}>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> Scheduled Brightness
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="time"
                          value={schedBrightness.time}
                          onChange={(e) => setSchedBrightness({ ...schedBrightness, time: e.target.value })}
                          style={{ background: '#0A0A0A', border: '1px solid #27272a', borderRadius: 6, color: '#e4e4e7', padding: '4px 8px', fontSize: 12 }}
                        />
                        <span style={{ color: '#71717a', fontSize: 12 }}>at</span>
                        <input
                          type="number"
                          min={1}
                          max={255}
                          value={schedBrightness.value}
                          onChange={(e) => setSchedBrightness({ ...schedBrightness, value: parseInt(e.target.value) || 1 })}
                          style={{ background: '#0A0A0A', border: '1px solid #27272a', borderRadius: 6, color: '#e4e4e7', padding: '4px 8px', fontSize: 12, width: 60 }}
                        />
                        <button
                          onClick={() => sendAction(d.cardId, 'scheduled-brightness', {
                            items: [{ time: schedBrightness.time, brightness: schedBrightness.value }],
                          })}
                          disabled={!!actionLoading}
                          className="portal-btn-secondary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                        >
                          Set
                        </button>
                      </div>
                    </div>

                    {/* Dangerous actions */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => cleanStorage(d.cardId)}
                        disabled={!!actionLoading}
                        style={{
                          ...btnStyle,
                          border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.08)',
                          color: '#FBBF24', cursor: 'pointer', borderRadius: 8, fontWeight: 500,
                        }}
                      >
                        <HardDrive size={14} /> Clean Storage
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Reboot this device? It will disconnect for ~30 seconds.')) {
                            sendAction(d.cardId, 'reboot')
                          }
                        }}
                        disabled={!!actionLoading}
                        style={{
                          ...btnStyle,
                          border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
                          color: '#EF4444', cursor: 'pointer', borderRadius: 8, fontWeight: 500,
                        }}
                      >
                        <RotateCcw size={14} /> Reboot Device
                      </button>
                    </div>

                    {/* Screenshot Preview */}
                    {screenshotUrl && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Screenshot:</div>
                        <img
                          src={screenshotUrl}
                          alt="Device screenshot"
                          style={{ width: '100%', minWidth: 600, borderRadius: 8, border: '1px solid #27272a' }}
                        />
                      </div>
                    )}

                    {/* Playing Info */}
                    {playingInfo && (
                      <div style={{
                        padding: '8px 12px', borderRadius: 8, fontSize: 13,
                        background: 'rgba(96,165,250,0.1)', color: '#60A5FA',
                      }}>
                        Now playing: {playingInfo}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="portal-section" style={{ marginTop: '2rem' }}>
        <h2>Setup Guide</h2>
        <div style={{ color: '#A3A3A3', fontSize: 14, lineHeight: 1.8 }}>
          <p><strong>1.</strong> Deploy the Realtime Server on a VPS (see <code>realtime-server/</code> folder)</p>
          <p><strong>2.</strong> Set the controller&apos;s server URL to your VPS address using LEDOK tool</p>
          <p><strong>3.</strong> Add <code>REALTIME_SERVER_URL</code> and <code>REALTIME_SERVER_SECRET</code> to your Vercel env vars</p>
          <p><strong>4.</strong> Click &quot;Setup Callbacks&quot; to configure automatic play log &amp; GPS forwarding</p>
          <p><strong>5.</strong> Push ads directly from the Campaigns page</p>
        </div>
      </div>
    </div>
  )
}
