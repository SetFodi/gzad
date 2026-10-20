'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { ArrowLeft, Minus, Plus } from 'lucide-react'
import Link from 'next/link'
import StatusBadge from '@/components/app/StatusBadge'

interface ClientDetail {
  id: string
  email: string
  company_name: string
  contact_name: string
  phone: string
  created_at: string
  balance: number | null
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

const gel = (value: number) => `₾${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function AdminClientDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([])
  const [spent, setSpent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const supabase = createClient()

      const [clientRes, campaignRes, txRes, daily] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).maybeSingle(),
        supabase.from('campaigns').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase
          .from('balance_transactions')
          .select('id, amount, balance_after, type, note, created_at')
          .eq('client_id', id)
          .neq('type', 'billing')
          .order('created_at', { ascending: false })
          .limit(50),
        // Daily totals stay small however many 10-minute rows there are; fall back
        // to the raw rows on a database without migration 010.
        supabase.from('billing_daily_totals').select('total_cost').eq('client_id', id),
      ])
      const charges = daily.error
        ? await supabase.from('billing_logs').select('total_cost').eq('client_id', id)
        : daily
      const failedRead = [clientRes, campaignRes, txRes, charges].find(result => result.error)
      if (failedRead) throw failedRead.error

      setClient(clientRes.data)
      setCampaigns(campaignRes.data || [])
      setTransactions(txRes.data || [])
      setSpent((charges.data || []).reduce((sum, r) => sum + Number(r.total_cost), 0))
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Balance changes go through the server so each one is applied atomically and
  // recorded in the ledger with the admin who made it.
  async function adjust(direction: 1 | -1) {
    const value = parseFloat(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setMessage({ ok: false, text: 'Enter an amount above zero.' })
      return
    }
    if (direction < 0 && !confirm(`Deduct ${gel(value)} from ${client?.company_name}?`)) return

    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: id, amount: direction * value, note }),
      })
      const result = await res.json()
      if (!res.ok) {
        setMessage({ ok: false, text: result.error || 'Balance update failed' })
        return
      }
      const resumed = result.reactivated
        ? ` ${result.reactivated} campaign(s) resumed on ${result.devicesSynced} device(s).`
        : ''
      setMessage({ ok: true, text: `Balance is now ${gel(Number(result.balance))}.${resumed}` })
      setAmount('')
      setNote('')
      await load()
    } catch {
      setMessage({ ok: false, text: 'Could not reach the server' })
    } finally {
      setSaving(false)
    }
  }

  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>Could not load this page from the database. Please try again.</p>
        <button type="button" className="portal-btn-primary" onClick={() => void load()}>Try again</button>
      </div>
    </div>
  )

  if (loading) return <div className="portal-loading">Loading…</div>
  if (!client) return <div className="portal-loading">Client not found</div>

  const balance = Number(client.balance ?? 0)
  const toppedUp = transactions
    .filter(tx => tx.amount > 0)
    .reduce((sum, tx) => sum + Number(tx.amount), 0)
  const activeCount = campaigns.filter(c => c.status === 'active').length

  return (
    <div className="portal-page">
      <Link href="/admin/clients" className="portal-back-link">
        <ArrowLeft size={16} /> Clients
      </Link>

      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{client.company_name}</h1>
          <p className="portal-subtitle">
            {[client.contact_name, client.email, client.phone].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <div className="overview-grid">
        <section className="balance-card" data-tone={balance <= 0 ? 'danger' : 'ok'}>
          <div className="balance-card-top">
            <span className="balance-card-label">Balance</span>
          </div>
          <div className="balance-card-value">
            <span className="balance-card-currency">₾</span>
            {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <form
            className="balance-form"
            onSubmit={(e) => { e.preventDefault(); adjust(1) }}
          >
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount, ₾"
              aria-label="Amount in lari"
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional), e.g. invoice number"
              aria-label="Note"
              maxLength={500}
            />
            <div className="balance-form-actions">
              <button type="submit" className="portal-btn-primary" disabled={saving}>
                <Plus size={15} aria-hidden /> Add
              </button>
              <button type="button" className="portal-btn-secondary" disabled={saving} onClick={() => adjust(-1)}>
                <Minus size={15} aria-hidden /> Deduct
              </button>
            </div>
          </form>
          {message && (
            <p className="balance-card-note" role="status" style={{ color: message.ok ? 'var(--portal-success)' : 'var(--portal-danger)' }}>
              {message.text}
            </p>
          )}
        </section>

        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-value">
              {activeCount}<span className="stat-card-of"> / {campaigns.length}</span>
            </span>
            <span className="stat-card-label">Active campaigns</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-value">{gel(toppedUp)}</span>
            <span className="stat-card-label">Topped up</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-value">{gel(spent)}</span>
            <span className="stat-card-label">Spent on airtime</span>
          </div>
        </div>
      </div>

      <div className="portal-section">
        <h2>Campaigns</h2>
        {campaigns.length === 0 ? (
          <div className="portal-empty portal-empty-sm"><p>No campaigns yet.</p></div>
        ) : (
          <div className="campaigns-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Dates</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/campaigns/${c.id}`} className="table-link">{c.name}</Link>
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="cell-nowrap">
                      {c.start_date || c.end_date ? `${c.start_date || '…'} → ${c.end_date || '…'}` : <span className="cell-sub">No end date</span>}
                    </td>
                    <td>{c.monthly_price ? `₾${c.monthly_price}/mo` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="portal-section">
        <h2>Balance history</h2>
        {transactions.length === 0 ? (
          <div className="portal-empty portal-empty-sm"><p>No top-ups or adjustments yet.</p></div>
        ) : (
          <div className="campaigns-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Note</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Balance after</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="cell-nowrap">
                      {new Date(tx.created_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Tbilisi', year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td>{TRANSACTION_LABELS[tx.type] || tx.type}</td>
                    <td className="cell-sub">{tx.note || '—'}</td>
                    <td style={{ textAlign: 'right', color: tx.amount > 0 ? 'var(--portal-success)' : 'var(--portal-danger)' }}>
                      {tx.amount > 0 ? '+' : '−'}{gel(Math.abs(Number(tx.amount)))}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {tx.balance_after !== null ? gel(Number(tx.balance_after)) : '—'}
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
