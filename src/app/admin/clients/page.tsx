'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Search, X } from 'lucide-react'
import AppDialog from '@/components/app/AppDialog'

interface Client {
  id: string
  email: string
  company_name: string
  contact_name: string
  phone: string
  created_at: string
  balance: number | null
  campaign_count?: number
  active_count?: number
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ email: '', password: '', company_name: '', contact_name: '', phone: '' })
  const supabase = createClient()

  async function loadClients() {
    setLoading(true)
    setLoadError(false)
    try {
      const { data, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('is_admin', false)
        .neq('role', 'fleet')
        .order('created_at', { ascending: false })

      if (clientsError) throw clientsError
      if (data) {
        const { data: campaigns, error: campaignsError } = await supabase.from('campaigns').select('client_id, status')
        if (campaignsError) throw campaignsError
        const totals = new Map<string, { all: number; active: number }>()
        for (const c of campaigns || []) {
          const entry = totals.get(c.client_id) ?? { all: 0, active: 0 }
          entry.all++
          if (c.status === 'active') entry.active++
          totals.set(c.client_id, entry)
        }
        setClients(data.map(client => ({
          ...client,
          campaign_count: totals.get(client.id)?.all ?? 0,
          active_count: totals.get(client.id)?.active ?? 0,
        })))
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
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

  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>Could not load this page from the database. Please try again.</p>
        <button type="button" className="portal-btn-primary" onClick={() => void loadClients()}>Try again</button>
      </div>
    </div>
  )

  if (loading) return <div className="portal-loading">Loading...</div>

  const visible = clients.filter(c => {
    const q = query.trim().toLowerCase()
    return !q || [c.company_name, c.contact_name, c.email, c.phone].some(v => (v ?? '').toLowerCase().includes(q))
  })

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">Clients</h1>
          <p className="portal-subtitle">Advertiser accounts, their balances and campaigns.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="portal-btn-primary">
          <Plus size={16} aria-hidden /> Add client
        </button>
      </div>

      {showCreate && (
        <AppDialog labelledBy="new-client-title" onClose={() => setShowCreate(false)}>
            <div className="admin-modal-header">
              <h2 id="new-client-title">New client account</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="admin-modal-close" aria-label="Close"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="portal-form">
              {error && <div className="portal-login-error" role="alert">{error}</div>}
              <div className="admin-form-row">
                <div className="portal-input-group">
                  <label htmlFor="c-company">Company</label>
                  <input id="c-company" type="text" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required autoFocus />
                </div>
                <div className="portal-input-group">
                  <label htmlFor="c-contact">Contact name</label>
                  <input id="c-contact" type="text" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} required />
                </div>
              </div>
              <div className="admin-form-row">
                <div className="portal-input-group">
                  <label htmlFor="c-email">Email</label>
                  <input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="portal-input-group">
                  <label htmlFor="c-phone">Phone</label>
                  <input id="c-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="portal-input-group">
                <label htmlFor="c-password">Temporary password</label>
                <input id="c-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} autoComplete="new-password" />
                <span className="field-hint">Share it with the client privately; they sign in at /portal/login.</span>
              </div>
              <button type="submit" disabled={creating} className="portal-btn-primary full-width">
                {creating ? 'Creating…' : 'Create account'}
              </button>
            </form>
        </AppDialog>
      )}

      <div className="table-toolbar">
        <span className="cell-sub">{clients.length} {clients.length === 1 ? 'client' : 'clients'}</span>
        <label className="search-field">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or phone"
            aria-label="Search clients"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="portal-empty">
          <p>{clients.length === 0 ? 'No clients yet.' : 'No clients match your search.'}</p>
        </div>
      ) : (
        <div className="campaigns-table-wrapper">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Campaigns</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const balance = Number(c.balance ?? 0)
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="cell-stack">
                        <Link href={`/admin/clients/${c.id}`} className="table-link">{c.company_name}</Link>
                        <span className="cell-sub">{c.contact_name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <span>{c.email}</span>
                        <span className="cell-sub">{c.phone || '—'}</span>
                      </div>
                    </td>
                    <td>
                      {c.active_count ? <span>{c.active_count} active</span> : null}
                      <span className="cell-sub">{c.active_count ? ` · ${c.campaign_count} total` : `${c.campaign_count} total`}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 500, color: balance <= 0 ? 'var(--portal-danger)' : 'var(--portal-text)' }}>
                      ₾{balance.toFixed(2)}
                    </td>
                    <td className="cell-nowrap cell-sub">{new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
