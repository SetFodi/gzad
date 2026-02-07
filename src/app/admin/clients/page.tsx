'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, X } from 'lucide-react'

interface Client {
  id: string
  email: string
  company_name: string
  contact_name: string
  phone: string
  created_at: string
  campaign_count?: number
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '', company_name: '', contact_name: '', phone: '' })
  const supabase = createClient()

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('is_admin', false)
      .order('created_at', { ascending: false })

    if (data) {
      // Get campaign counts
      const withCounts = await Promise.all(
        data.map(async (client) => {
          const { count } = await supabase
            .from('campaigns')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', client.id)
          return { ...client, campaign_count: count || 0 }
        })
      )
      setClients(withCounts)
    }
    setLoading(false)
  }

  useEffect(() => { loadClients() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')

    try {
      // Create auth user via admin API route
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to create client')

      setShowCreate(false)
      setForm({ email: '', password: '', company_name: '', contact_name: '', phone: '' })
      await loadClients()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create client')
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <div className="portal-loading">Loading...</div>

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <h1 className="portal-page-title">Clients</h1>
        <button onClick={() => setShowCreate(true)} className="portal-btn-primary">
          <Plus size={18} /> Add Client
        </button>
      </div>

      {showCreate && (
        <div className="admin-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Create Client Account</h2>
              <button onClick={() => setShowCreate(false)} className="admin-modal-close"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="portal-form">
              {error && <div className="portal-login-error">{error}</div>}
              <div className="portal-input-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="portal-input-group">
                <label>Password</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              </div>
              <div className="portal-input-group">
                <label>Company Name</label>
                <input type="text" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required />
              </div>
              <div className="portal-input-group">
                <label>Contact Name</label>
                <input type="text" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} required />
              </div>
              <div className="portal-input-group">
                <label>Phone</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <button type="submit" disabled={creating} className="portal-btn-primary full-width">
                {creating ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="portal-empty">
          <p>No clients yet.</p>
        </div>
      ) : (
        <div className="campaigns-table-wrapper">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Campaigns</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/clients/${c.id}`} className="table-link">{c.company_name}</Link>
                  </td>
                  <td>{c.contact_name}</td>
                  <td>{c.email}</td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.campaign_count}</td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
