'use client'

import { useEffect, useState, useCallback } from 'react'
import { Monitor, Wifi, WifiOff, RefreshCw, Sun, Power, Send, Settings, Camera, Volume2, Trash2, Play, Clock, RotateCcw, HardDrive, MapPin, Search } from 'lucide-react'

interface Device {
  cardId: string
  online: boolean
  connectedAt: string
  lastSeen: string
  info: Record<string, unknown>
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

  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/devices')
      const data = await res.json()
      if (Array.isArray(data)) {
        setDevices(data)
        setError('')
      } else if (data.devices) {
        setDevices(data.devices)
        setError(data.error || '')
      } else {
        setError(data.error || 'Failed to load devices')
      }
    } catch {
      setError('Cannot reach Realtime Server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDevices()
    const interval = setInterval(loadDevices, 10000)
    return () => clearInterval(interval)
  }, [loadDevices])

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
        // SDK returns: {"result":"/9j/4AAQSkZJRg..."} — result IS the base64 string directly
        const imgData = typeof data.result === 'string' && data.result.startsWith('/9j/')
          ? data.result
          : data.result?.screenshot || data.result?.data || data.result?.img || null

        if (imgData) {
          // SDK docs: remove \n line breaks from base64 string
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
      const res = await fetch('/api/devices/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, action: 'get-gps' }),
      })
      const data = await res.json()
      if (res.ok) {
        const lat = data.lat || data.result?.lat || 0
        const lng = data.lng || data.result?.lng || 0
        if (lat && lng && !(lat === 0 && lng === 0)) {
          setActionResult({
            ok: true,
            msg: `GPS Location`,
            data: `Lat: ${lat}, Lng: ${lng}\nhttps://www.google.com/maps?q=${lat},${lng}`,
          })
        } else {
          setActionResult({ ok: false, msg: 'GPS: No fix (0,0) — device may be indoors or no GPS antenna' })
        }
      } else {
        setActionResult({ ok: false, msg: `GPS: ${data.error || 'Failed'}` })
      }
    } catch {
      setActionResult({ ok: false, msg: 'GPS: Failed to connect' })
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
        <button onClick={loadDevices} className="portal-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && (
        <div className="portal-login-error" style={{ marginBottom: '1rem' }}>
          {error}. Make sure the Realtime Server is running.
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
          <p>No devices connected.</p>
          <p style={{ color: '#525252', fontSize: 14 }}>
            Point your controller&apos;s server URL to this Realtime Server to see it here.
          </p>
        </div>
      ) : (
        <div className="campaigns-grid">
          {devices.map((d) => (
            <div key={d.cardId} className="campaign-card" style={{ cursor: 'default' }}>
              <div className="campaign-card-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Monitor size={18} />
                  {d.cardId}
                </h3>
                <span className="status-badge" style={{
                  color: d.online ? '#CCF381' : '#EF4444',
                  borderColor: d.online ? '#CCF381' : '#EF4444',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {d.online ? <Wifi size={14} /> : <WifiOff size={14} />}
                  {d.online ? 'Online' : 'Offline'}
                </span>
              </div>

              <div className="campaign-card-details">
                <div>
                  <span className="detail-label">Connected</span>
                  <span>{d.connectedAt ? new Date(d.connectedAt).toLocaleString() : '—'}</span>
                </div>
                <div>
                  <span className="detail-label">Last Seen</span>
                  <span>{d.lastSeen ? new Date(d.lastSeen).toLocaleString() : '—'}</span>
                </div>
              </div>

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
                    <button onClick={() => sendAction(d.cardId, 'screen', { on: true })} disabled={!!actionLoading} className="portal-btn-secondary" style={btnStyle}>
                      <Power size={14} /> Screen On
                    </button>
                    <button onClick={() => sendAction(d.cardId, 'screen', { on: false })} disabled={!!actionLoading} className="portal-btn-secondary" style={btnStyle}>
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

                  {/* Reboot — separate, dangerous */}
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
                      color: '#EF4444', cursor: 'pointer', borderRadius: 8, fontWeight: 500, width: 'fit-content',
                    }}
                  >
                    <RotateCcw size={14} /> Reboot Device
                  </button>

                  {/* Screenshot Preview */}
                  {screenshotUrl && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Screenshot:</div>
                      <img
                        src={screenshotUrl}
                        alt="Device screenshot"
                        style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #27272a' }}
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
          ))}
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
