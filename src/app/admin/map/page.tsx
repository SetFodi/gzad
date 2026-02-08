'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw } from 'lucide-react'
import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('@/components/admin/MapView'), { ssr: false })

interface GpsPoint {
  id: string
  device_serial: string
  lat: number
  lng: number
  speed: number
  recorded_at: string
}

export default function MapPage() {
  const [points, setPoints] = useState<GpsPoint[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadGPS = async () => {
    setLoading(true)
    // Get latest GPS points per device from the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data } = await supabase
      .from('gps_logs')
      .select('*')
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: false })
      .limit(500)

    setPoints(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadGPS()
    const interval = setInterval(loadGPS, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  // Group by device, take latest point per device
  const latestByDevice = new Map<string, GpsPoint>()
  for (const p of points) {
    if (!latestByDevice.has(p.device_serial)) {
      latestByDevice.set(p.device_serial, p)
    }
  }
  const devicePositions = Array.from(latestByDevice.values())

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <h1 className="portal-page-title">GPS Map</h1>
        <button onClick={loadGPS} className="portal-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div style={{
        background: '#0A0A0A',
        border: '1px solid #1A1A1A',
        borderRadius: 12,
        overflow: 'hidden',
        height: 500,
        position: 'relative',
      }}>
        {loading && points.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#525252' }}>
            Loading GPS data...
          </div>
        ) : devicePositions.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#525252', flexDirection: 'column', gap: 8 }}>
            <p>No GPS data in the last 24 hours.</p>
            <p style={{ fontSize: 13 }}>GPS data will appear once the controller starts reporting.</p>
          </div>
        ) : (
          <MapView positions={devicePositions} allPoints={points} />
        )}
      </div>

      <div style={{ marginTop: 16, color: '#525252', fontSize: 13 }}>
        Showing {devicePositions.length} device(s), {points.length} GPS points in last 24h
      </div>
    </div>
  )
}
