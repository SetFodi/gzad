'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ClientDetail {
  id: string
  email: string
  company_name: string
  contact_name: string
  phone: string
  created_at: string
}

interface Campaign {
  id: string
  name: string
  status: string
  start_date: string
  end_date: string
  monthly_price: number
}

interface BalanceTransaction {
  id: string
  amount: number
  balance_after: number | null
  type: string
  note: string | null
  created_at: string
}

const TRANSACTION_LABELS: Record<string, string> = {
  topup: 'Top-up',
  adjustment: 'Adjustment',
  billing: 'Airtime',
  refund: 'Refund',
}

export default function AdminClientDetailPage() {
  const params = useParams()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([])
  const [spent, setSpent] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const id = params.id as string

      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single()

      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false })

      const { data: txData } = await supabase
        .from('balance_transactions')
        .select('id, amount, balance_after, type, note, created_at')
        .eq('client_id', id)
        .neq('type', 'billing')
        .order('created_at', { ascending: false })
        .limit(50)

      const { data: chargeData } = await supabase
        .from('billing_logs')
        .select('total_cost')
        .eq('client_id', id)

      setClient(clientData)
      setCampaigns(campaignData || [])
      setTransactions(txData || [])
      setSpent((chargeData || []).reduce((sum, r) => sum + Number(r.total_cost), 0))
      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) return <div className="portal-loading">Loading...</div>
  if (!client) return <div className="portal-loading">Client not found</div>

  const toppedUp = transactions
    .filter(tx => tx.amount > 0)
    .reduce((sum, tx) => sum + Number(tx.amount), 0)

  return (
    <div className="portal-page">
      <Link href="/admin/clients" className="portal-back-link">
        <ArrowLeft size={16} /> Back to Clients
      </Link>

      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{client.company_name}</h1>
          <p className="portal-subtitle">{client.contact_name} &middot; {client.email} {client.phone ? `&middot; ${client.phone}` : ''}</p>
        </div>
      </div>

      <div className="stats-grid three-col">
        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-value">{campaigns.length}</span>
            <span className="stat-card-label">Campaigns</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-value" style={{ color: 'var(--portal-success)' }}>{toppedUp.toFixed(2)} GEL</span>
            <span className="stat-card-label">Total Topped Up</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-value" style={{ color: 'var(--portal-warning)' }}>{spent.toFixed(2)} GEL</span>
            <span className="stat-card-label">Spent on Airtime</span>
          </div>
        </div>
      </div>

      {campaigns.length > 0 && (
        <div className="portal-section">
          <h2>Campaigns</h2>
          <div className="campaigns-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Period</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/portal/dashboard/campaigns/${c.id}`} className="table-link">{c.name}</Link>
                    </td>
                    <td>
                      <span className="status-badge" style={{
                        color: c.status === 'active' ? 'var(--portal-success)' : c.status === 'pending_review' ? 'var(--portal-warning)' : 'var(--portal-muted)',
                        borderColor: c.status === 'active' ? 'var(--portal-success)' : c.status === 'pending_review' ? 'var(--portal-warning)' : 'var(--portal-muted)',
                      }}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{c.start_date || '—'} → {c.end_date || '—'}</td>
                    <td>{c.monthly_price ? `${c.monthly_price} GEL/mo` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {transactions.length > 0 && (
        <div className="portal-section">
          <h2>Balance History</h2>
          <div className="campaigns-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Note</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Balance After</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                      {new Date(tx.created_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Tbilisi', year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td>{TRANSACTION_LABELS[tx.type] || tx.type}</td>
                    <td style={{ color: 'var(--portal-muted)', fontSize: 13 }}>{tx.note || '—'}</td>
                    <td style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: tx.amount > 0 ? 'var(--portal-success)' : 'var(--portal-danger)',
                    }}>
                      {tx.amount > 0 ? '+' : ''}{Number(tx.amount).toFixed(2)} GEL
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {tx.balance_after !== null ? `${Number(tx.balance_after).toFixed(2)} GEL` : '—'}
                    </td>
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
