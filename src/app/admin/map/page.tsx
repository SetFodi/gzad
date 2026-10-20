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
  speed: number | null
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
  const [loadError, setLoadError] = useState(false)
  const [showDistricts, setShowDistricts] = useState(false)
  const [date, setDate] = useState<string>(todayInTbilisi())
  const [startTime, setStartTime] = useState<string>('00:00')
  const [endTime, setEndTime] = useState<string>('23:59')
  const supabase = createClient()

  const loadGPS = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const { start, end } = tbilisiRange(date, startTime, endTime)

      // Read GPS from play_logs — each ad play records its location.
      const { data, error } = await supabase
        .from('play_logs')
        .select('id, device_id, lat, lng, began_at')
        .gte('began_at', start)
        .lte('began_at', end)
        .not('lat', 'eq', 0)
        .not('lng', 'eq', 0)
        .order('began_at', { ascending: true })
        .limit(5000)

      if (error) throw error
      const mapped: GpsPoint[] = (data || []).map(r => ({
        id: r.id,
        device_serial: r.device_id,
        lat: r.lat,
        lng: r.lng,
        speed: null,
        recorded_at: r.began_at,
      }))
      setPoints(mapped)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [supabase, date, startTime, endTime])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadGPS() is async: it flips a loading flag, then sets results once the query resolves
    loadGPS()
  }, [loadGPS])

  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>Could not load GPS reports from the database. Please try again.</p>
        <button type="button" className="portal-btn-primary" onClick={() => void loadGPS()}>Try again</button>
      </div>
    </div>
  )

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
        <div>
          <h1 className="portal-page-title">GPS trails</h1>
          <p className="portal-subtitle">
            Where each screen went. {devicePositions.length} {devicePositions.length === 1 ? 'screen' : 'screens'}, {points.length.toLocaleString()} GPS points on {date}, {startTime}–{endTime}.
          </p>
        </div>
        <div className="admin-header-actions">
          <button type="button" onClick={() => setShowDistricts(v => !v)} className="portal-btn-secondary" aria-pressed={showDistricts}>
            <Layers size={16} aria-hidden /> {showDistricts ? 'Hide districts' : 'Show districts'}
          </button>
          <button type="button" onClick={loadGPS} className="portal-btn-secondary">
            <RefreshCw size={16} aria-hidden /> Refresh
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <label className="filter-field">
          <span>Date</span>
          <input type="date" value={date} max={todayInTbilisi()} onChange={e => setDate(e.target.value)} />
        </label>
        <label className="filter-field">
          <span>From</span>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
        </label>
        <label className="filter-field">
          <span>To</span>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </label>
        <button
          type="button"
          onClick={() => { setDate(todayInTbilisi()); setStartTime('00:00'); setEndTime('23:59') }}
          className="action-btn"
        >
          Today, all day
        </button>
      </div>

      <div className="map-card map-card-tall">
        {loading && points.length === 0 ? (
          <div className="portal-loading" style={{ minHeight: '100%' }}>Loading GPS data…</div>
        ) : devicePositions.length === 0 ? (
          <div className="portal-empty" style={{ height: '100%', boxShadow: 'none' }}>
            <p>No GPS data for {isToday ? 'today' : date} between {startTime} and {endTime}. A point is recorded at the start of each ad play.</p>
          </div>
        ) : (
          <MapView positions={devicePositions} allPoints={points} showDistricts={showDistricts} />
        )}
      </div>
    </div>
  )
}
