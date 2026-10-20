'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
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
  const [loadError, setLoadError] = useState(false)
  const [realtimeError, setRealtimeError] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/devices')
      const data = await res.json()
      if (!res.ok || !Array.isArray(data.devices)) throw new Error('Failed to load devices')
      setAllDevices(data.devices)
      setRealtimeError(!!data.realtimeError)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>Could not load this page from the database. Please try again.</p>
        <button type="button" className="portal-btn-primary" onClick={() => void load()}>Try again</button>
      </div>
    </div>
  )

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
        <div>
          <h1 className="portal-page-title">Fleet map</h1>
          <p className="portal-subtitle">
            {realtimeError ? 'Live status unavailable' : `${onlineCount} online · ${offlineCount} offline`} · {mappedDevices.length} of {allDevices.length} with a GPS fix · refreshes every 30 seconds
          </p>
        </div>
        <button type="button" onClick={load} className="portal-btn-secondary">
          <RefreshCw size={16} aria-hidden /> Refresh
        </button>
      </div>

      {realtimeError && <div className="portal-alert portal-alert-warning" role="status">Live screen status is unavailable. Positions below are the last locations saved in the database.</div>}

      <div className="map-layout">
        <div className="map-list">
          {allDevices.length === 0 && <p className="cell-sub" style={{ padding: 16, margin: 0 }}>No screens yet.</p>}
          {allDevices.map(d => {
            const hasFix = d.last_lat !== null && d.last_lng !== null
            return (
              <button
                key={d.cardId}
                type="button"
                className="map-list-item"
                aria-pressed={focusedId === d.cardId}
                disabled={!hasFix}
                onClick={() => setFocusedId(d.cardId)}
              >
                <span className="device-presence" data-online={d.online || undefined} aria-hidden />
                <span className="cell-stack" style={{ minWidth: 0 }}>
                  <span className="recent-name">{d.name || d.cardId}</span>
                  <span className="cell-sub">
                    {d.lastSeen
                      ? new Date(d.lastSeen).toLocaleString('en-GB', { timeZone: 'Asia/Tbilisi', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : 'Never seen'}
                    {!hasFix && ' · no GPS'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="map-card map-card-tall">
          {loading && mappedDevices.length === 0 ? (
            <div className="portal-loading" style={{ minHeight: '100%' }}>Loading…</div>
          ) : mappedDevices.length === 0 ? (
            <div className="portal-empty" style={{ height: '100%', boxShadow: 'none' }}>
              <p>No GPS positions yet. Screens appear on the map once they report a location.</p>
            </div>
          ) : (
            <FleetMapView devices={mappedDevices} focusedId={focusedId} />
          )}
        </div>
      </div>
    </div>
  )
}
