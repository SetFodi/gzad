'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Search, X } from 'lucide-react'
import AppDialog from '@/components/app/AppDialog'
import { useAdminText } from '@/lib/admin-i18n'

interface Client {
  id: string
  email: string
  company_name: string
  contact_name: string
  phone: string
  created_at: string
  balance: number | null
  is_admin?: boolean
  role?: string
  campaign_count?: number
  active_count?: number
}

export default function AdminClientsPage() {
  const { t, locale } = useAdminText()
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
      // Advertisers, plus any staff or fleet account that owns campaigns:
      // those are billed like anyone else and need their balance managed here.
      const [{ data: accounts, error: clientsError }, { data: campaigns, error: campaignsError }] = await Promise.all([
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('campaigns').select('client_id, status'),
      ])
      if (clientsError) throw clientsError
      if (campaignsError) throw campaignsError
      const owners = new Set((campaigns || []).map(c => c.client_id))
      const data = (accounts || []).filter(a => owners.has(a.id) || (!a.is_admin && a.role !== 'fleet'))
      if (data) {
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
      if (!res.ok) throw new Error(result.error || t('Failed to create client'))

      setShowCreate(false)
      setForm({ email: '', password: '', company_name: '', contact_name: '', phone: '' })
      await loadClients()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Failed to create client'))
    } finally {
      setCreating(false)
    }
  }

  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>{t('Could not load this page from the database. Please try again.')}</p>
        <button type="button" className="portal-btn-primary" onClick={() => void loadClients()}>{t('Try again')}</button>
      </div>
    </div>
  )

  if (loading) return <div className="portal-loading">{t('Loading…')}</div>

  const visible = clients.filter(c => {
    const q = query.trim().toLowerCase()
    return !q || [c.company_name, c.contact_name, c.email, c.phone].some(v => (v ?? '').toLowerCase().includes(q))
  })

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{t('Clients')}</h1>
          <p className="portal-subtitle">{t('Advertiser accounts, their balances and campaigns.')}</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="portal-btn-primary">
          <Plus size={16} aria-hidden /> {t('Add client')}
        </button>
      </div>

      {showCreate && (
        <AppDialog labelledBy="new-client-title" onClose={() => setShowCreate(false)}>
            <div className="admin-modal-header">
              <h2 id="new-client-title">{t('New client account')}</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="admin-modal-close" aria-label={t('Close')}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="portal-form">
              {error && <div className="portal-login-error" role="alert">{error}</div>}
              <div className="admin-form-row">
                <div className="portal-input-group">
                  <label htmlFor="c-company">{t('Company')}</label>
                  <input id="c-company" type="text" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required autoFocus />
                </div>
                <div className="portal-input-group">
                  <label htmlFor="c-contact">{t('Contact name')}</label>
                  <input id="c-contact" type="text" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} required />
                </div>
              </div>
              <div className="admin-form-row">
                <div className="portal-input-group">
                  <label htmlFor="c-email">{t('Email')}</label>
                  <input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="portal-input-group">
                  <label htmlFor="c-phone">{t('Phone')}</label>
                  <input id="c-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="portal-input-group">
                <label htmlFor="c-password">{t('Temporary password')}</label>
                <input id="c-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} autoComplete="new-password" />
                <span className="field-hint">{t('Share it with the client privately; they sign in at /portal/login.')}</span>
              </div>
              <button type="submit" disabled={creating} className="portal-btn-primary full-width">
                {creating ? t('Creating…') : t('Create account')}
              </button>
            </form>
        </AppDialog>
      )}

      <div className="table-toolbar">
        <span className="cell-sub">{clients.length === 1 ? t('1 client') : t('{n} clients', { n: clients.length })}</span>
        <label className="search-field">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search name, email or phone')}
            aria-label={t('Search clients')}
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="portal-empty">
          <p>{clients.length === 0 ? t('No clients yet.') : t('No clients match your search.')}</p>
        </div>
      ) : (
        <div className="campaigns-table-wrapper">
          <table className="portal-table">
            <thead>
              <tr>
                <th>{t('Company')}</th>
                <th>{t('Contact')}</th>
                <th>{t('Campaigns')}</th>
                <th style={{ textAlign: 'right' }}>{t('Balance')}</th>
                <th>{t('Joined')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const balance = Number(c.balance ?? 0)
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="cell-stack">
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Link href={`/admin/clients/${c.id}`} className="table-link">{c.company_name}</Link>
                          {(c.is_admin || c.role === 'fleet') && (
                            <span className="portal-chip" title={c.is_admin ? t('Staff account that owns campaigns') : t('Fleet account that owns campaigns')}>
                              {c.is_admin ? t('Staff') : t('Fleet')}
                            </span>
                          )}
                        </span>
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
                      {c.active_count ? <span>{t('{n} active', { n: c.active_count })}</span> : null}
                      <span className="cell-sub">{c.active_count ? ` · ${t('{n} total', { n: c.campaign_count ?? 0 })}` : t('{n} total', { n: c.campaign_count ?? 0 })}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 500, color: balance <= 0 ? 'var(--portal-danger)' : 'var(--portal-text)' }}>
                      {balance < 0 ? `−₾${Math.abs(balance).toFixed(2)}` : `₾${balance.toFixed(2)}`}
                    </td>
                    <td className="cell-nowrap cell-sub">{new Date(c.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
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
