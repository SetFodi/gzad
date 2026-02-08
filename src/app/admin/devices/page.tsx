'use client'

import { useEffect, useState, useCallback } from 'react'
import { Monitor, Wifi, WifiOff, RefreshCw, Sun, Power, Send, Settings } from 'lucide-react'

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
  const [actionResult, setActionResult] = useState('')
  const [brightness, setBrightness] = useState(100)

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
    const interval = setInterval(loadDevices, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [loadDevices])

  const sendAction = async (cardId: string, action: string, params: Record<string, unknown> = {}) => {
    setActionLoading(`${cardId}-${action}`)
    setActionResult('')
    try {
      const res = await fetch('/api/devices/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, action, ...params }),
      })
      const data = await res.json()
      if (res.ok) {
        setActionResult(`${action}: Success`)
      } else {
        setActionResult(`${action}: ${data.error}`)
      }
    } catch {
      setActionResult(`${action}: Failed to connect`)
    } finally {
      setActionLoading(null)
    }
  }

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
        <div className="portal-success-msg" style={{ marginBottom: '1rem' }}>
          {actionResult}
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

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => sendAction(d.cardId, 'screen', { on: true })}
                      disabled={!!actionLoading}
                      className="portal-btn-secondary"
                      style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Power size={14} /> Screen On
                    </button>
                    <button
                      onClick={() => sendAction(d.cardId, 'screen', { on: false })}
                      disabled={!!actionLoading}
                      className="portal-btn-secondary"
                      style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Power size={14} /> Screen Off
                    </button>
                    <button
                      onClick={() => sendAction(d.cardId, 'info')}
                      disabled={!!actionLoading}
                      className="portal-btn-secondary"
                      style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Settings size={14} /> Get Info
                    </button>
                    <button
                      onClick={() => sendAction(d.cardId, 'setup-callbacks')}
                      disabled={!!actionLoading}
                      className="portal-btn-secondary"
                      style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Send size={14} /> Setup Callbacks
                    </button>
                  </div>
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
