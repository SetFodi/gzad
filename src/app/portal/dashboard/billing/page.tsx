'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from '@/lib/i18n'
import { Receipt, WalletCards, Wallet } from 'lucide-react'

interface BillingLog {
  id: string
  period_start: string
  device_id: string
  district: string
  total_cost: number
  campaigns: { name: string } | null
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

export default function BillingPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [charges, setCharges] = useState<BillingLog[]>([])
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([])
  const [spent30, setSpent30] = useState(0)
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

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const [{ data: chargeData }, { data: spendData }, { data: txData }] = await Promise.all([
        supabase
          .from('billing_logs')
          .select('id, period_start, device_id, district, total_cost, campaigns(name)')
          .eq('client_id', client.id)
          .order('period_start', { ascending: false })
          .limit(50),
        supabase
          .from('billing_logs')
          .select('total_cost')
          .eq('client_id', client.id)
          .gte('period_start', thirtyDaysAgo.toISOString()),
        supabase
          .from('balance_transactions')
          .select('id, amount, balance_after, type, note, created_at')
          .eq('client_id', client.id)
          .neq('type', 'billing')
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      setCharges((chargeData || []) as unknown as BillingLog[])
      setSpent30((spendData || []).reduce((sum, r) => sum + Number(r.total_cost), 0))
      setTransactions(txData || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="portal-loading">{c.loading}</div>

  const toppedUp = transactions
    .filter(tx => tx.amount > 0)
    .reduce((sum, tx) => sum + Number(tx.amount), 0)

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{p.title}</h1>
          <p className="portal-subtitle">{p.subtitle}</p>
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
            <span className="stat-card-value" style={{ color: 'var(--portal-warning)' }}>{spent30.toFixed(2)} GEL</span>
            <span className="stat-card-label">{p.spent30}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-success)' }}>
            <WalletCards size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value" style={{ color: 'var(--portal-success)' }}>{toppedUp.toFixed(2)} GEL</span>
            <span className="stat-card-label">{p.toppedUp}</span>
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

      <div className="portal-section">
        <h2>{p.balanceHistory}</h2>
        {transactions.length === 0 ? (
          <p className="portal-empty-text" style={{ color: 'var(--portal-muted)', fontSize: 13 }}>{p.noBalanceHistory}</p>
        ) : (
          <div className="campaigns-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>{p.date}</th>
                  <th>{p.type}</th>
                  <th>{p.note}</th>
                  <th style={{ textAlign: 'right' }}>{p.amount}</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
