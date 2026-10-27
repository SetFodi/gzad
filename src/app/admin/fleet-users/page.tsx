'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Monitor, X, Link2, Unlink } from 'lucide-react'
import AppDialog from '@/components/app/AppDialog'
import { useAdminText } from '@/lib/admin-i18n'

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?'

interface FleetUser {
  id: string
  email: string
  contact_name: string
  phone: string | null
  created_at: string
  vehicles: FleetVehicle[]
}

interface FleetVehicle {
  id: string
  make: string
  model: string
  year: number
  color: string
  license_plate: string
  device_id: string | null
}

interface Device {
  id: string
  name: string | null
}

export default function AdminFleetUsersPage() {
  const { t, locale } = useAdminText()
  const [fleetUsers, setFleetUsers] = useState<FleetUser[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [assignModal, setAssignModal] = useState<{ vehicleId: string; currentDeviceId: string | null } | null>(null)
  const [selectedDevice, setSelectedDevice] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      // Load fleet users with their vehicles
      const { data: users, error: usersError } = await supabase
        .from('clients')
        .select('id, email, contact_name, phone, created_at')
        .eq('role', 'fleet')
        .order('created_at', { ascending: false })

      if (usersError) throw usersError
      if (users) {
        const withVehicles = await Promise.all(
          users.map(async (u) => {
            const { data: vehicles, error: vehiclesError } = await supabase
              .from('fleet_vehicles')
              .select('id, make, model, year, color, license_plate, device_id')
              .eq('fleet_user_id', u.id)
              .order('created_at', { ascending: false })
            if (vehiclesError) throw vehiclesError
            return { ...u, vehicles: vehicles || [] }
          })
        )
        setFleetUsers(withVehicles)
      }

      // Load all devices for assignment dropdown
      const { data: devs, error: devicesError } = await supabase
        .from('devices')
        .select('id, name')
        .order('id')

      if (devicesError) throw devicesError
      if (devs) setDevices(devs)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Get device IDs that are already assigned to any vehicle
  const assignedDeviceIds = new Set(
    fleetUsers.flatMap(u => u.vehicles.filter(v => v.device_id).map(v => v.device_id!))
  )

  const handleAssign = async () => {
    if (!assignModal) return
    setAssigning(true)
    setError('')

    try {
      const res = await fetch('/api/admin/fleet/assign-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: assignModal.vehicleId,
          device_id: selectedDevice || null,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || t('Could not assign the screen'))

      setAssignModal(null)
      setSelectedDevice('')
      await loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Could not assign the screen'))
    } finally {
      setAssigning(false)
    }
  }

  const handleUnassign = async (vehicleId: string) => {
    if (!confirm(t('Remove the screen from this vehicle?'))) return

    try {
      await fetch('/api/admin/fleet/assign-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_id: vehicleId, device_id: null }),
      })
      await loadData()
    } catch {
      // ignore
    }
  }

  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>{t('Could not load this page from the database. Please try again.')}</p>
        <button type="button" className="portal-btn-primary" onClick={() => void loadData()}>{t('Try again')}</button>
      </div>
    </div>
  )

  if (loading) return <div className="portal-loading">{t('Loading…')}</div>

  const vehicleCount = fleetUsers.reduce((sum, u) => sum + u.vehicles.length, 0)
  const withLed = fleetUsers.reduce((sum, u) => sum + u.vehicles.filter(v => v.device_id).length, 0)

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{t('Fleets')}</h1>
          <p className="portal-subtitle">
            {fleetUsers.length === 1 ? t('1 fleet') : t('{n} fleets', { n: fleetUsers.length })} · {vehicleCount === 1 ? t('1 vehicle') : t('{n} vehicles', { n: vehicleCount })} · {t('{n} with a screen', { n: withLed })}
          </p>
        </div>
      </div>

      {assignModal && (
        <AppDialog labelledBy="assign-title" onClose={() => setAssignModal(null)}>
            <div className="admin-modal-header">
              <h2 id="assign-title">{t('Assign a screen')}</h2>
              <button type="button" onClick={() => setAssignModal(null)} className="admin-modal-close" aria-label={t('Close')}><X size={20} /></button>
            </div>
            <div className="portal-form">
              {error && <div className="portal-login-error" role="alert">{error}</div>}
              <div className="portal-input-group">
                <label htmlFor="assign-device">{t('Screen')}</label>
                <select
                  id="assign-device"
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                >
                  <option value="">{t('No screen')}</option>
                  {devices.map((d) => (
                    <option
                      key={d.id}
                      value={d.id}
                      disabled={assignedDeviceIds.has(d.id) && d.id !== assignModal.currentDeviceId}
                    >
                      {d.name || d.id}{assignedDeviceIds.has(d.id) && d.id !== assignModal.currentDeviceId ? ` (${t('in another car')})` : ''}
                    </option>
                  ))}
                </select>
                <span className="field-hint">{t('A screen can be in one car at a time.')}</span>
              </div>
              <button type="button" onClick={handleAssign} disabled={assigning} className="portal-btn-primary full-width">
                {assigning ? t('Saving…') : t('Save')}
              </button>
            </div>
        </AppDialog>
      )}

      {fleetUsers.length === 0 ? (
        <div className="portal-empty">
          <p>{t('No fleets have signed up yet.')}</p>
          <p style={{ fontSize: 14 }}>{t('Fleets sign up at')} <code>/portal/fleet-signup?role=fleet</code>.</p>
        </div>
      ) : (
        <div className="group-grid">
          {fleetUsers.map((u) => (
            <article key={u.id} className="group-card">
              <header className="group-card-head">
                <span className="app-avatar" aria-hidden>{initials(u.contact_name)}</span>
                <div className="cell-stack" style={{ flex: 1 }}>
                  <span className="group-card-name">{u.contact_name}</span>
                  <span className="cell-sub">{[u.email, u.phone].filter(Boolean).join(' · ')}</span>
                </div>
                <span className="cell-sub cell-nowrap">
                  {t('Joined {date}', { date: new Date(u.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) })}
                </span>
              </header>

              {u.vehicles.length === 0 ? (
                <p className="cell-sub" style={{ margin: 0 }}>{t('No vehicles added yet.')}</p>
              ) : (
                <ul className="vehicle-list">
                  {u.vehicles.map((v) => (
                    <li key={v.id} className="vehicle-row">
                      <span className="plate">{v.license_plate}</span>
                      <div className="cell-stack" style={{ flex: 1 }}>
                        <span>{v.year} {v.make} {v.model}</span>
                        <span className="cell-sub">{v.color}</span>
                      </div>
                      {v.device_id ? (
                        <span className="portal-chip" style={{ color: 'var(--portal-success)' }}>
                          <Monitor size={12} aria-hidden /> {v.device_id}
                        </span>
                      ) : (
                        <span className="portal-chip">{t('No screen')}</span>
                      )}
                      <div className="device-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDevice(v.device_id || '')
                            setAssignModal({ vehicleId: v.id, currentDeviceId: v.device_id })
                            setError('')
                          }}
                          className="action-btn"
                        >
                          <Link2 size={13} aria-hidden /> {v.device_id ? t('Change') : t('Assign')}
                        </button>
                        {v.device_id && (
                          <button type="button" onClick={() => handleUnassign(v.id)} className="action-btn reject">
                            <Unlink size={13} aria-hidden /> {t('Remove')}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
