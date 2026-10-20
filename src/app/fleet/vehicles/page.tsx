'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'
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
  const [loadError, setLoadError] = useState(false)
  const [deleteError, setDeleteError] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const [form, setForm] = useState({ make: '', model: '', year: new Date().getFullYear(), color: '', license_plate: '' })
  const { t } = useTranslations()
  const f = t.fleet.vehicles
  const common = t.fleet.common

  const loadVehicles = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const res = await fetch('/api/fleet/vehicles')
      if (!res.ok) throw new Error('Vehicles unavailable')
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('Invalid vehicle list')
      setVehicles(data)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadVehicles() }, [loadVehicles])

  useEffect(() => {
    if (!showAdd || !dialog.current) return
    const element = dialog.current
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [showAdd])

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
      if (!res.ok) throw new Error(result.error || common.addFailed)

      setShowAdd(false)
      setForm({ make: '', model: '', year: new Date().getFullYear(), color: '', license_plate: '' })
      await loadVehicles()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : common.addFailed)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(f.confirmDelete)) return
    setDeleting(id)
    setDeleteError(false)
    try {
      const res = await fetch('/api/fleet/vehicles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Unable to delete vehicle')
      await loadVehicles()
    } catch {
      setDeleteError(true)
    } finally {
      setDeleting(null)
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

  if (loading) return <div className="portal-loading">{common.loading}</div>

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <h1 className="portal-page-title">{f.title}</h1>
        <button type="button" onClick={() => { setError(''); setShowAdd(true) }} className="portal-btn-primary">
          <Plus size={18} /> {f.addVehicle}
        </button>
      </div>

      {loadError && (
        <div className="portal-alert portal-alert-danger" role="alert">
          <p>{common.loadFailed}</p>
          <button type="button" className="portal-btn-secondary" onClick={loadVehicles}>{common.retry}</button>
        </div>
      )}
      {deleteError && <div className="portal-alert portal-alert-danger" role="alert">{common.deleteFailed}</div>}

      {showAdd && (
        <dialog
          ref={dialog}
          className="admin-modal"
          aria-labelledby="add-vehicle-title"
          onCancel={event => { event.preventDefault(); if (!creating) setShowAdd(false) }}
          onClick={event => {
            const bounds = event.currentTarget.getBoundingClientRect()
            const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom
            if (event.target === event.currentTarget && outside && !creating) setShowAdd(false)
          }}
        >
          <div className="admin-modal-header">
            <h2 id="add-vehicle-title">{f.addVehicle}</h2>
            <button type="button" onClick={() => setShowAdd(false)} className="admin-modal-close" aria-label={common.close} disabled={creating}><X size={20} aria-hidden /></button>
          </div>
          <form onSubmit={handleAdd} className="portal-form">
            {error && <div className="portal-login-error" role="alert">{error}</div>}
            <div className="admin-form-row">
              <div className="portal-input-group">
                <label htmlFor="vehicle-make">{f.make}</label>
                <input
                  id="vehicle-make"
                  type="text"
                  value={form.make}
                  onChange={(e) => setForm({ ...form, make: e.target.value })}
                  placeholder={f.makePlaceholder}
                  required
                />
              </div>
              <div className="portal-input-group">
                <label htmlFor="vehicle-model">{f.model}</label>
                <input
                  id="vehicle-model"
                  type="text"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder={f.modelPlaceholder}
                  required
                />
              </div>
            </div>
            <div className="admin-form-row">
              <div className="portal-input-group">
                <label htmlFor="vehicle-year">{f.year}</label>
                <input
                  id="vehicle-year"
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || 2020 })}
                  min={1990}
                  max={new Date().getFullYear() + 1}
                  required
                />
              </div>
              <div className="portal-input-group">
                <label htmlFor="vehicle-color">{f.color}</label>
                <input
                  id="vehicle-color"
                  type="text"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  placeholder={f.colorPlaceholder}
                  required
                />
              </div>
            </div>
            <div className="portal-input-group">
              <label htmlFor="vehicle-licensePlate">{f.licensePlate}</label>
              <input
                id="vehicle-licensePlate"
                type="text"
                value={form.license_plate}
                onChange={(e) => handlePlateChange(e.target.value)}
                placeholder="AA 000 AA"
                pattern="[A-Za-z]{2} [0-9]{3} [A-Za-z]{2}"
                maxLength={9}
                aria-describedby="vehicle-plate-hint"
                style={{ fontFamily: 'monospace', letterSpacing: 2, fontSize: 16 }}
                required
              />
              <span id="vehicle-plate-hint" className="field-hint">{f.plateHint}</span>
            </div>
            <button type="submit" disabled={creating} className="portal-btn-primary full-width">
              {creating ? f.adding : f.addVehicle}
            </button>
          </form>
        </dialog>
      )}

      {!loadError && (vehicles.length === 0 ? (
        <div className="portal-empty">
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
                  <td><span className="plate">{v.license_plate}</span></td>
                  <td>{v.year} {v.make} {v.model}</td>
                  <td>{v.color}</td>
                  <td>
                    {v.device_id ? (
                      <span className="portal-chip" style={{ color: 'var(--portal-success)' }}>{v.device_id}</span>
                    ) : (
                      <span className="portal-chip">{f.notAssigned}</span>
                    )}
                  </td>
                  <td>{new Date(v.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id)}
                      className="app-icon-btn danger"
                      title={f.delete}
                      disabled={deleting !== null}
                      aria-busy={deleting === v.id}
                      aria-label={`${f.delete} ${v.license_plate}`}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
