'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from '@/lib/i18n'
import { Receipt, WalletCards, Wallet } from 'lucide-react'

interface Invoice {
  id: string
  amount: number
  status: string
  due_date: string
  paid_at: string | null
  created_at: string
  campaigns: { name: string } | null
}

interface BillingLog {
  id: string
  period_start: string
  device_id: string
  district: string
  total_cost: number
  campaigns: { name: string } | null
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [balance, setBalance] = useState<number | null>(null)
  const [charges, setCharges] = useState<BillingLog[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { t } = useTranslations()
  const p = t.portal.billing
  const c = t.portal.common

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: client } = await supabase
        .from('clients')
        .select('id, balance')
        .eq('auth_user_id', user.id)
        .single()

      if (!client) { setLoading(false); return }

      setBalance(typeof client.balance === 'number' ? client.balance : 0)

      const [{ data: invoiceData }, { data: chargeData }] = await Promise.all([
        supabase
          .from('invoices')
          .select('*, campaigns(name)')
          .eq('client_id', client.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('billing_logs')
          .select('id, period_start, device_id, district, total_cost, campaigns(name)')
          .eq('client_id', client.id)
          .order('period_start', { ascending: false })
          .limit(50),
      ])

      setInvoices(invoiceData || [])
      setCharges((chargeData || []) as unknown as BillingLog[])
      setLoading(false)
    }
    load()
  }, [])

  const statusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'var(--portal-success)'
      case 'pending': return 'var(--portal-warning)'
      case 'overdue': return 'var(--portal-danger)'
      default: return 'var(--portal-muted)'
    }
  }

  if (loading) return <div className="portal-loading">{c.loading}</div>

  const totalPending = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.amount, 0)
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{p.title}</h1>
          <p className="portal-subtitle">Campaign invoices, balances, and payment status.</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: (balance ?? 0) > 0 ? 'var(--portal-success)' : 'var(--portal-danger)' }}>
            <Wallet size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value" style={{ color: (balance ?? 0) > 0 ? 'var(--portal-success)' : 'var(--portal-danger)' }}>
              {(balance ?? 0).toFixed(2)} GEL
            </span>
            <span className="stat-card-label">{p.balance}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-warning)' }}>
            <Receipt size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value" style={{ color: 'var(--portal-warning)' }}>{totalPending} GEL</span>
            <span className="stat-card-label">{p.pending}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-success)' }}>
            <WalletCards size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value" style={{ color: 'var(--portal-success)' }}>{totalPaid} GEL</span>
            <span className="stat-card-label">{p.paid}</span>
          </div>
        </div>
      </div>

      <p style={{ color: 'var(--portal-muted)', fontSize: 13, marginTop: -8, marginBottom: 24 }}>
        {p.balanceHint}
      </p>

      <div className="portal-section">
        <h2>{p.recentCharges}</h2>
        {charges.length === 0 ? (
          <p className="portal-empty-text" style={{ color: 'var(--portal-muted)', fontSize: 13 }}>{p.noCharges}</p>
        ) : (
          <div className="campaigns-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>{p.time}</th>
                  <th>{p.campaign}</th>
                  <th>{p.district}</th>
                  <th style={{ textAlign: 'right' }}>{p.cost}</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                      {new Date(l.period_start).toLocaleString('en-GB', { timeZone: 'Asia/Tbilisi', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>{l.campaigns?.name || '—'}</td>
                    <td>{l.district || '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{l.total_cost.toFixed(2)} GEL</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {invoices.length > 0 && (
        <div className="portal-section">
          <div className="campaigns-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>{p.campaign}</th>
                  <th>{p.amount}</th>
                  <th>{p.status}</th>
                  <th>{p.dueDate}</th>
                  <th>{p.paidDate}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.campaigns?.name || '—'}</td>
                    <td>{inv.amount} GEL</td>
                    <td>
                      <span className="status-badge" style={{ color: statusColor(inv.status), borderColor: statusColor(inv.status) }}>
                        {inv.status}
                      </span>
                    </td>
                    <td>{inv.due_date}</td>
                    <td>{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
