'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Wifi, WifiOff, Monitor } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { DevicePoint } from '@/components/admin/FleetMapView'

const FleetMapView = dynamic(() => import('@/components/admin/FleetMapView'), { ssr: false })

interface ApiDevice {
  cardId: string
  name: string | null
  online: boolean
  connectedAt: string | null
  lastSeen: string | null
  last_lat: number | null
  last_lng: number | null
}

export default function FleetPage() {
  const [allDevices, setAllDevices] = useState<ApiDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/devices')
      const data = await res.json()
      setAllDevices(data.devices || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const mappedDevices: DevicePoint[] = allDevices
    .filter(d => d.last_lat !== null && d.last_lng !== null)
    .map(d => ({
      id: d.cardId,
      name: d.name,
      lat: d.last_lat!,
      lng: d.last_lng!,
      online: d.online,
      lastSeen: d.lastSeen,
    }))

  const onlineCount = allDevices.filter(d => d.online).length
  const offlineCount = allDevices.length - onlineCount

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <h1 className="portal-page-title">Fleet Map</h1>
        <button onClick={load} className="portal-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(96,165,250,0.1)' }}>
            <Monitor size={24} color="#60A5FA" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{allDevices.length}</span>
            <span className="stat-card-label">Total Devices</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(204,243,129,0.1)' }}>
            <Wifi size={24} color="#CCF381" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{onlineCount}</span>
            <span className="stat-card-label">Online</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(82,82,82,0.15)' }}>
            <WifiOff size={24} color="#525252" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{offlineCount}</span>
            <span className="stat-card-label">Offline</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Device list */}
        <div style={{
          width: 220, flexShrink: 0,
          background: '#0A0A0A', border: '1px solid #1A1A1A',
          borderRadius: 12, overflow: 'hidden',
          maxHeight: 500, overflowY: 'auto',
        }}>
          {allDevices.length === 0 && (
            <div style={{ padding: 16, color: '#525252', fontSize: 13 }}>No devices</div>
          )}
          {allDevices.map(d => {
            const hasFix = d.last_lat !== null && d.last_lng !== null
            return (
              <button
                key={d.cardId}
                onClick={() => hasFix ? setFocusedId(d.cardId) : undefined}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px',
                  background: focusedId === d.cardId ? 'rgba(204,243,129,0.08)' : 'transparent',
                  border: 'none', borderBottom: '1px solid #141414',
                  cursor: hasFix ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: d.online ? '#CCF381' : '#525252',
                  boxShadow: d.online ? '0 0 6px rgba(204,243,129,0.6)' : 'none',
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, color: '#F1F5F9', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {d.name || d.cardId}
                  </div>
                  <div style={{ fontSize: 11, color: '#525252' }}>
                    {d.lastSeen ? new Date(d.lastSeen).toLocaleTimeString() : 'Never seen'}
                    {!hasFix && ' · no GPS'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Map */}
        <div style={{
          flex: 1, background: '#0A0A0A', border: '1px solid #1A1A1A',
          borderRadius: 12, overflow: 'hidden', height: 500, position: 'relative',
        }}>
          {loading && mappedDevices.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#525252' }}>
              Loading...
            </div>
          ) : mappedDevices.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#525252', gap: 8 }}>
              <p>No GPS positions available.</p>
              <p style={{ fontSize: 13 }}>Devices will appear once they report a location.</p>
            </div>
          ) : (
            <FleetMapView devices={mappedDevices} focusedId={focusedId} />
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, color: '#525252', fontSize: 13 }}>
        {mappedDevices.length} of {allDevices.length} device(s) have GPS · auto-refreshes every 30s
      </div>
    </div>
  )
}
