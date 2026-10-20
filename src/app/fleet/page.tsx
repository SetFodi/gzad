'use client'

import { useEffect, useState } from 'react'
import { Car, Play, Clock, MapPin } from 'lucide-react'
import Link from 'next/link'
import StatusBadge from '@/components/app/StatusBadge'
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
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { t } = useTranslations()
  const f = t.fleet.dashboard
  const common = t.fleet.common

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setLoadError(false)
      try {
        const res = await fetch('/api/fleet/stats', { signal: controller.signal })
        if (!res.ok) throw new Error('Fleet statistics unavailable')
        const data = await res.json()
        if (!Array.isArray(data.vehicles) || !Array.isArray(data.stats)) throw new Error('Invalid fleet statistics')
        if (!controller.signal.aborted) {
          setVehicles(data.vehicles)
          setStats(data.stats)
        }
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [attempt])

  const assignedVehicles = vehicles.filter(v => v.device_id)
  const totalPlays = stats.reduce((sum, s) => sum + s.total_plays, 0)
  const totalDuration = stats.reduce((sum, s) => sum + s.total_duration_seconds, 0)

  if (loading) return <div className="portal-loading">{common.loading}</div>

  if (loadError) return (
    <div className="portal-page">
      <h1 className="portal-page-title">{f.title}</h1>
      <div className="portal-alert portal-alert-danger" role="alert">{common.loadFailed}</div>
      <button type="button" className="portal-btn-secondary" onClick={() => setAttempt(value => value + 1)}>{common.retry}</button>
    </div>
  )

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{f.title}</h1>
          <p className="portal-subtitle">{f.last30Days}</p>
        </div>
        <Link href="/fleet/vehicles" className="portal-btn-secondary">{f.manageVehicles}</Link>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
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
      <h2 style={{ margin: '36px 0 14px' }}>{f.yourVehicles}</h2>

      {vehicles.length === 0 ? (
        <div className="portal-empty">
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
                  <StatusBadge status={v.device_id ? 'active' : 'none'}>
                    {v.device_id ? f.ledAssigned : f.noLED}
                  </StatusBadge>
                </div>

                <div className="campaign-card-details">
                  <div>
                    <span className="detail-label">{f.licensePlate}</span>
                    <span className="plate">{v.license_plate}</span>
                  </div>
                  <div>
                    <span className="detail-label">{f.color}</span>
                    <span>{v.color}</span>
                  </div>
                  {v.device_id && (
                    <div>
                      <span className="detail-label">{f.deviceId}</span>
                      <span style={{ fontSize: 12, color: 'var(--portal-muted)', overflowWrap: 'anywhere', minWidth: 0, textAlign: 'right' }}>{v.device_id}</span>
                    </div>
                  )}
                </div>

                {deviceStat && (
                  <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: 'var(--portal-bg)' }}>
                      <div style={{ fontSize: 12, color: 'var(--portal-muted)', marginBottom: 8, fontWeight: 700 }}>
                      {f.last30Days}
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                        <Play size={14} style={{ color: 'var(--portal-primary)' }} />
                        <span style={{ color: 'var(--portal-text)' }}>{deviceStat.total_plays} {f.plays}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                        <Clock size={14} style={{ color: 'var(--portal-info)' }} />
                        <span style={{ color: 'var(--portal-text)' }}>
                          {deviceStat.total_duration_seconds >= 3600
                            ? `${Math.floor(deviceStat.total_duration_seconds / 3600)}h ${Math.floor((deviceStat.total_duration_seconds % 3600) / 60)}m`
                            : `${Math.floor(deviceStat.total_duration_seconds / 60)}m`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                        <MapPin size={14} style={{ color: 'var(--portal-warning)' }} />
                        <span style={{ color: 'var(--portal-text)' }}>{deviceStat.km_covered} km</span>
                      </div>
                    </div>
                    {deviceStat.last_play && (
                      <div style={{ fontSize: 11, color: 'var(--portal-muted)', marginTop: 6 }}>
                        {f.lastPlay}: {new Date(deviceStat.last_play).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {!v.device_id && (
                  <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: 'var(--portal-bg)', color: 'var(--portal-muted)', fontSize: 14 }}>
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
