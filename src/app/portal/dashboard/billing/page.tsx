'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Invoice {
  id: string
  amount: number
  status: string
  due_date: string
  paid_at: string | null
  created_at: string
  campaigns: { name: string } | null
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (!client) { setLoading(false); return }

      const { data } = await supabase
        .from('invoices')
        .select('*, campaigns(name)')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })

      setInvoices(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const statusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#CCF381'
      case 'pending': return '#FBBF24'
      case 'overdue': return '#EF4444'
      default: return '#64748B'
    }
  }

  if (loading) return <div className="portal-loading">Loading...</div>

  const totalPending = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.amount, 0)
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)

  return (
    <div className="portal-page">
      <h1 className="portal-page-title">Billing</h1>

      <div className="stats-grid two-col">
        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-value" style={{ color: '#FBBF24' }}>{totalPending} GEL</span>
            <span className="stat-card-label">Pending</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-value" style={{ color: '#CCF381' }}>{totalPaid} GEL</span>
            <span className="stat-card-label">Paid</span>
          </div>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="portal-empty">
          <p>No invoices yet.</p>
        </div>
      ) : (
        <div className="portal-section">
          <div className="campaigns-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Paid</th>
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
