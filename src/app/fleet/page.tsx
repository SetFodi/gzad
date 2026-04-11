'use client'

import { useEffect, useState } from 'react'
import { Car, Monitor, Play, Clock, MapPin } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from '@/lib/i18n'

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  color: string
  license_plate: string
  device_id: string | null
}

interface DeviceStat {
  device_id: string
  total_plays: number
  total_duration_seconds: number
  unique_campaigns: number
  km_covered: number
  last_play: string | null
}

export default function FleetDashboardPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [stats, setStats] = useState<DeviceStat[]>([])
  const [loading, setLoading] = useState(true)
  const { t } = useTranslations()
  const f = t.fleet.dashboard

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/fleet/stats')
        const data = await res.json()
        setVehicles(data.vehicles || [])
        setStats(data.stats || [])
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const assignedVehicles = vehicles.filter(v => v.device_id)
  const totalPlays = stats.reduce((sum, s) => sum + s.total_plays, 0)
  const totalDuration = stats.reduce((sum, s) => sum + s.total_duration_seconds, 0)
  const totalKm = stats.reduce((sum, s) => sum + s.km_covered, 0)

  if (loading) return <div className="portal-loading">Loading...</div>

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <h1 className="portal-page-title">{f.title}</h1>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-label">{f.totalVehicles}</div>
          <div className="stat-value">{vehicles.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{f.assignedLEDs}</div>
          <div className="stat-value">{assignedVehicles.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{f.totalPlays}</div>
          <div className="stat-value">{totalPlays.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{f.totalScreenTime}</div>
          <div className="stat-value">
            {totalDuration >= 3600
              ? `${Math.floor(totalDuration / 3600)}h ${Math.floor((totalDuration % 3600) / 60)}m`
              : `${Math.floor(totalDuration / 60)}m`}
          </div>
        </div>
      </div>

      {/* Vehicles with stats */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#e4e4e7' }}>{f.yourVehicles}</h2>

      {vehicles.length === 0 ? (
        <div className="portal-empty">
          <Car size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <p>{f.noVehicles}</p>
          <Link href="/fleet/vehicles" className="portal-btn-primary" style={{ marginTop: 12, display: 'inline-flex' }}>
            {f.addVehicle}
          </Link>
        </div>
      ) : (
        <div className="campaigns-grid">
          {vehicles.map((v) => {
            const deviceStat = stats.find(s => s.device_id === v.device_id)
            return (
              <div key={v.id} className="campaign-card" style={{ cursor: 'default' }}>
                <div className="campaign-card-header">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Car size={18} />
                    <span>{v.year} {v.make} {v.model}</span>
                  </h3>
                  <span className="status-badge" style={{
                    color: v.device_id ? '#CCF381' : '#71717a',
                    borderColor: v.device_id ? '#CCF381' : '#27272a',
                  }}>
                    <Monitor size={14} />
                    {v.device_id ? f.ledAssigned : f.noLED}
                  </span>
                </div>

                <div className="campaign-card-details">
                  <div>
                    <span className="detail-label">{f.licensePlate}</span>
                    <span style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{v.license_plate}</span>
                  </div>
                  <div>
                    <span className="detail-label">{f.color}</span>
                    <span>{v.color}</span>
                  </div>
                  {v.device_id && (
                    <div>
                      <span className="detail-label">{f.deviceId}</span>
                      <span style={{ fontSize: 12, color: '#71717a' }}>{v.device_id}</span>
                    </div>
                  )}
                </div>

                {deviceStat && (
                  <div style={{
                    marginTop: 12, padding: '12px 14px', borderRadius: 8,
                    background: 'rgba(204,243,129,0.04)', border: '1px solid rgba(204,243,129,0.1)',
                  }}>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 500 }}>
                      {f.last30Days}
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                        <Play size={14} style={{ color: '#CCF381' }} />
                        <span style={{ color: '#e4e4e7' }}>{deviceStat.total_plays} {f.plays}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                        <Clock size={14} style={{ color: '#60A5FA' }} />
                        <span style={{ color: '#e4e4e7' }}>
                          {deviceStat.total_duration_seconds >= 3600
                            ? `${Math.floor(deviceStat.total_duration_seconds / 3600)}h ${Math.floor((deviceStat.total_duration_seconds % 3600) / 60)}m`
                            : `${Math.floor(deviceStat.total_duration_seconds / 60)}m`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                        <MapPin size={14} style={{ color: '#FBBF24' }} />
                        <span style={{ color: '#e4e4e7' }}>{deviceStat.km_covered} km</span>
                      </div>
                    </div>
                    {deviceStat.last_play && (
                      <div style={{ fontSize: 11, color: '#71717a', marginTop: 6 }}>
                        {f.lastPlay}: {new Date(deviceStat.last_play).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {!v.device_id && (
                  <div style={{
                    marginTop: 12, padding: '12px 14px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid #1a1a1a',
                    color: '#71717a', fontSize: 13,
                  }}>
                    {f.awaitingAssignment}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
