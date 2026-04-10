'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, Layers } from 'lucide-react'
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

// Tbilisi local time → UTC ISO range for a given date + start/end HH:MM
function tbilisiRange(date: string, startTime: string, endTime: string) {
  const start = new Date(`${date}T${startTime}:00+04:00`).toISOString()
  const end = new Date(`${date}T${endTime}:59.999+04:00`).toISOString()
  return { start, end }
}

function todayInTbilisi(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' })
}

export default function MapPage() {
  const [points, setPoints] = useState<GpsPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showDistricts, setShowDistricts] = useState(false)
  const [date, setDate] = useState<string>(todayInTbilisi())
  const [startTime, setStartTime] = useState<string>('00:00')
  const [endTime, setEndTime] = useState<string>('23:59')
  const supabase = createClient()

  const loadGPS = useCallback(async () => {
    setLoading(true)
    const { start, end } = tbilisiRange(date, startTime, endTime)

    // Read GPS from play_logs — each ad play records its location.
    const { data } = await supabase
      .from('play_logs')
      .select('id, device_id, lat, lng, began_at')
      .gte('began_at', start)
      .lte('began_at', end)
      .not('lat', 'eq', 0)
      .not('lng', 'eq', 0)
      .order('began_at', { ascending: true })
      .limit(5000)

    const mapped: GpsPoint[] = (data || []).map(r => ({
      id: r.id,
      device_serial: r.device_id,
      lat: r.lat,
      lng: r.lng,
      speed: 0,
      recorded_at: r.began_at,
    }))
    setPoints(mapped)
    setLoading(false)
  }, [supabase, date, startTime, endTime])

  useEffect(() => {
    loadGPS()
  }, [loadGPS])

  // Latest point per device (trail end)
  const latestByDevice = new Map<string, GpsPoint>()
  for (const p of points) {
    latestByDevice.set(p.device_serial, p)
  }
  const devicePositions = Array.from(latestByDevice.values())

  const isToday = date === todayInTbilisi()

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <h1 className="portal-page-title">GPS Trails</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowDistricts(v => !v)}
            className="portal-btn-secondary"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: showDistricts ? 'rgba(204,243,129,0.1)' : undefined,
              color: showDistricts ? '#CCF381' : undefined,
              borderColor: showDistricts ? 'rgba(204,243,129,0.3)' : undefined,
            }}
          >
            <Layers size={16} /> {showDistricts ? 'Hide Districts' : 'Show Districts'}
          </button>
          <button onClick={loadGPS} className="portal-btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Date + time range selector */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#737373' }}>Date</label>
          <input
            type="date"
            value={date}
            max={todayInTbilisi()}
            onChange={e => setDate(e.target.value)}
            style={{
              background: '#0A0A0A', border: '1px solid #1A1A1A', color: '#e5e5e5',
              padding: '8px 12px', borderRadius: 8, fontSize: 13,
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#737373' }}>From</label>
          <input
            type="time"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            style={{
              background: '#0A0A0A', border: '1px solid #1A1A1A', color: '#e5e5e5',
              padding: '8px 12px', borderRadius: 8, fontSize: 13,
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: '#737373' }}>To</label>
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            style={{
              background: '#0A0A0A', border: '1px solid #1A1A1A', color: '#e5e5e5',
              padding: '8px 12px', borderRadius: 8, fontSize: 13,
            }}
          />
        </div>
        <button
          onClick={() => { setDate(todayInTbilisi()); setStartTime('00:00'); setEndTime('23:59') }}
          className="portal-btn-secondary"
          style={{ fontSize: 13 }}
        >
          Reset to today
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
            <p>No GPS data for {isToday ? 'today' : date} between {startTime} and {endTime}.</p>
            <p style={{ fontSize: 13 }}>GPS is recorded at the start of each ad play.</p>
          </div>
        ) : (
          <MapView positions={devicePositions} allPoints={points} showDistricts={showDistricts} />
        )}
      </div>

      <div style={{ marginTop: 16, color: '#525252', fontSize: 13 }}>
        Showing {devicePositions.length} device(s), {points.length} GPS points for {date} {startTime}–{endTime}
      </div>
    </div>
  )
}
