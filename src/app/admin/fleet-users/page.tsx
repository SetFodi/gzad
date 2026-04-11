'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Car, Monitor, X, Link2, Unlink } from 'lucide-react'

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
  const [fleetUsers, setFleetUsers] = useState<FleetUser[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [assignModal, setAssignModal] = useState<{ vehicleId: string; currentDeviceId: string | null } | null>(null)
  const [selectedDevice, setSelectedDevice] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const loadData = useCallback(async () => {
    // Load fleet users with their vehicles
    const { data: users } = await supabase
      .from('clients')
      .select('id, email, contact_name, phone, created_at')
      .eq('role', 'fleet')
      .order('created_at', { ascending: false })

    if (users) {
      const withVehicles = await Promise.all(
        users.map(async (u) => {
          const { data: vehicles } = await supabase
            .from('fleet_vehicles')
            .select('id, make, model, year, color, license_plate, device_id')
            .eq('fleet_user_id', u.id)
            .order('created_at', { ascending: false })
          return { ...u, vehicles: vehicles || [] }
        })
      )
      setFleetUsers(withVehicles)
    }

    // Load all devices for assignment dropdown
    const { data: devs } = await supabase
      .from('devices')
      .select('id, name')
      .order('id')

    if (devs) setDevices(devs)

    setLoading(false)
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
      if (!res.ok) throw new Error(result.error || 'Failed to assign device')

      setAssignModal(null)
      setSelectedDevice('')
      await loadData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to assign device')
    } finally {
      setAssigning(false)
    }
  }

  const handleUnassign = async (vehicleId: string) => {
    if (!confirm('Unassign LED from this vehicle?')) return

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

  if (loading) return <div className="portal-loading">Loading...</div>

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <h1 className="portal-page-title">Fleet Users</h1>
        <span style={{ color: '#71717a', fontSize: 14 }}>
          {fleetUsers.length} driver{fleetUsers.length !== 1 ? 's' : ''} registered
        </span>
      </div>

      {/* Assign Device Modal */}
      {assignModal && (
        <div className="admin-modal-overlay" onClick={() => setAssignModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Assign LED to Vehicle</h2>
              <button onClick={() => setAssignModal(null)} className="admin-modal-close"><X size={20} /></button>
            </div>
            <div className="portal-form">
              {error && <div className="portal-login-error">{error}</div>}
              <div className="portal-input-group">
                <label>Select Device</label>
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1px solid #27272a', background: '#0A0A0A', color: '#e4e4e7',
                    fontSize: 14,
                  }}
                >
                  <option value="">-- No device --</option>
                  {devices.map((d) => (
                    <option
                      key={d.id}
                      value={d.id}
                      disabled={assignedDeviceIds.has(d.id) && d.id !== assignModal.currentDeviceId}
                    >
                      {d.name || d.id}{assignedDeviceIds.has(d.id) && d.id !== assignModal.currentDeviceId ? ' (assigned)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAssign}
                disabled={assigning}
                className="portal-btn-primary full-width"
              >
                {assigning ? 'Assigning...' : 'Assign Device'}
              </button>
            </div>
          </div>
        </div>
      )}

      {fleetUsers.length === 0 ? (
        <div className="portal-empty">
          <Car size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <p>No fleet users registered yet.</p>
          <p style={{ color: '#525252', fontSize: 14 }}>
            Fleet users can sign up at <code>/portal/fleet-signup</code>
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {fleetUsers.map((u) => (
            <div key={u.id} className="campaign-card" style={{ cursor: 'default' }}>
              <div className="campaign-card-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Car size={18} />
                  <span>{u.contact_name}</span>
                </h3>
                <span style={{ color: '#71717a', fontSize: 13 }}>
                  {u.vehicles.length} vehicle{u.vehicles.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="campaign-card-details">
                <div>
                  <span className="detail-label">Email</span>
                  <span>{u.email}</span>
                </div>
                <div>
                  <span className="detail-label">Phone</span>
                  <span>{u.phone || '—'}</span>
                </div>
                <div>
                  <span className="detail-label">Joined</span>
                  <span>{new Date(u.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {u.vehicles.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <table className="portal-table" style={{ fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>Plate</th>
                        <th>Vehicle</th>
                        <th>Color</th>
                        <th>LED</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {u.vehicles.map((v) => (
                        <tr key={v.id}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600, letterSpacing: 1 }}>
                            {v.license_plate}
                          </td>
                          <td>{v.year} {v.make} {v.model}</td>
                          <td>{v.color}</td>
                          <td>
                            {v.device_id ? (
                              <span style={{ color: '#CCF381', fontSize: 12 }}>
                                <Monitor size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                                {v.device_id}
                              </span>
                            ) : (
                              <span style={{ color: '#71717a', fontSize: 12 }}>None</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button
                                onClick={() => {
                                  setSelectedDevice(v.device_id || '')
                                  setAssignModal({ vehicleId: v.id, currentDeviceId: v.device_id })
                                  setError('')
                                }}
                                className="portal-btn-secondary"
                                style={{ padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                              >
                                <Link2 size={12} /> {v.device_id ? 'Change' : 'Assign'}
                              </button>
                              {v.device_id && (
                                <button
                                  onClick={() => handleUnassign(v.id)}
                                  style={{
                                    padding: '4px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                                    border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
                                    color: '#EF4444', cursor: 'pointer', borderRadius: 8,
                                  }}
                                >
                                  <Unlink size={12} /> Unassign
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
