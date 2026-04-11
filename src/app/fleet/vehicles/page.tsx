'use client'

import { useEffect, useState } from 'react'
import { Car, Plus, X, Trash2 } from 'lucide-react'
import { useTranslations } from '@/lib/i18n'

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  color: string
  license_plate: string
  device_id: string | null
  created_at: string
}

export default function FleetVehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ make: '', model: '', year: new Date().getFullYear(), color: '', license_plate: '' })
  const { t } = useTranslations()
  const f = t.fleet.vehicles

  async function loadVehicles() {
    try {
      const res = await fetch('/api/fleet/vehicles')
      const data = await res.json()
      if (Array.isArray(data)) setVehicles(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadVehicles() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')

    try {
      const res = await fetch('/api/fleet/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to add vehicle')

      setShowAdd(false)
      setForm({ make: '', model: '', year: new Date().getFullYear(), color: '', license_plate: '' })
      await loadVehicles()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add vehicle')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(f.confirmDelete)) return

    try {
      const res = await fetch('/api/fleet/vehicles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) await loadVehicles()
    } catch {
      // ignore
    }
  }

  // Format license plate as user types: XX 000 XX
  const handlePlateChange = (value: string) => {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    let formatted = ''
    for (let i = 0; i < clean.length && i < 7; i++) {
      if (i === 2 || i === 5) formatted += ' '
      formatted += clean[i]
    }
    setForm({ ...form, license_plate: formatted })
  }

  if (loading) return <div className="portal-loading">Loading...</div>

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <h1 className="portal-page-title">{f.title}</h1>
        <button onClick={() => setShowAdd(true)} className="portal-btn-primary">
          <Plus size={18} /> {f.addVehicle}
        </button>
      </div>

      {showAdd && (
        <div className="admin-modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{f.addVehicle}</h2>
              <button onClick={() => setShowAdd(false)} className="admin-modal-close"><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd} className="portal-form">
              {error && <div className="portal-login-error">{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="portal-input-group">
                  <label>{f.make}</label>
                  <input
                    type="text"
                    value={form.make}
                    onChange={(e) => setForm({ ...form, make: e.target.value })}
                    placeholder={f.makePlaceholder}
                    required
                  />
                </div>
                <div className="portal-input-group">
                  <label>{f.model}</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder={f.modelPlaceholder}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="portal-input-group">
                  <label>{f.year}</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || 2020 })}
                    min={1990}
                    max={new Date().getFullYear() + 1}
                    required
                  />
                </div>
                <div className="portal-input-group">
                  <label>{f.color}</label>
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    placeholder={f.colorPlaceholder}
                    required
                  />
                </div>
              </div>
              <div className="portal-input-group">
                <label>{f.licensePlate}</label>
                <input
                  type="text"
                  value={form.license_plate}
                  onChange={(e) => handlePlateChange(e.target.value)}
                  placeholder="AA 000 AA"
                  style={{ fontFamily: 'monospace', letterSpacing: 2, fontSize: 16 }}
                  required
                />
                <span style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>{f.plateHint}</span>
              </div>
              <button type="submit" disabled={creating} className="portal-btn-primary full-width">
                {creating ? f.adding : f.addVehicle}
              </button>
            </form>
          </div>
        </div>
      )}

      {vehicles.length === 0 ? (
        <div className="portal-empty">
          <Car size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <p>{f.noVehicles}</p>
        </div>
      ) : (
        <div className="campaigns-table-wrapper">
          <table className="portal-table">
            <thead>
              <tr>
                <th>{f.licensePlate}</th>
                <th>{f.vehicle}</th>
                <th>{f.color}</th>
                <th>{f.led}</th>
                <th>{f.added}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontFamily: 'monospace', letterSpacing: 1, fontWeight: 600 }}>
                    {v.license_plate}
                  </td>
                  <td>{v.year} {v.make} {v.model}</td>
                  <td>{v.color}</td>
                  <td>
                    {v.device_id ? (
                      <span style={{ color: '#CCF381', fontSize: 12 }}>{v.device_id}</span>
                    ) : (
                      <span style={{ color: '#71717a', fontSize: 12 }}>{f.notAssigned}</span>
                    )}
                  </td>
                  <td>{new Date(v.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      onClick={() => handleDelete(v.id)}
                      style={{
                        background: 'none', border: 'none', color: '#EF4444',
                        cursor: 'pointer', padding: 4, display: 'flex',
                      }}
                      title={f.delete}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
