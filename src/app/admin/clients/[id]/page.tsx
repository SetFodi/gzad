'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { ArrowLeft, Minus, Plus } from 'lucide-react'
import Link from 'next/link'
import StatusBadge from '@/components/app/StatusBadge'
import TestBalanceBox from '@/components/app/TestBalanceBox'
import { useAdminText } from '@/lib/admin-i18n'
import { formatGel, gelParts } from '@/lib/money'

interface ClientDetail {
  id: string
  email: string
  company_name: string
  contact_name: string
  phone: string
  created_at: string
  balance: number | null
  billing_exempt?: boolean
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

const gel = (value: number) => formatGel(value)

export default function AdminClientDetailPage() {
  const { t, locale } = useAdminText()
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
  const [savingExempt, setSavingExempt] = useState(false)

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
      setMessage({ ok: false, text: t('Enter an amount above zero.') })
      return
    }
    if (direction < 0 && !confirm(t('Deduct {amount} from {client}?', { amount: gel(value), client: client?.company_name ?? '' }))) return

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
        setMessage({ ok: false, text: result.error || t('Balance update failed') })
        return
      }
      const resumed = result.reactivated
        ? ' ' + t('{n} campaign(s) resumed on {devices} device(s).', { n: result.reactivated, devices: result.devicesSynced })
        : ''
      setMessage({ ok: true, text: t('Balance is now {amount}.', { amount: gel(Number(result.balance)) }) + resumed })
      setAmount('')
      setNote('')
      await load()
    } catch {
      setMessage({ ok: false, text: t('Could not reach the server') })
    } finally {
      setSaving(false)
    }
  }

  async function setExempt(exempt: boolean) {
    if (!client) return
    if (exempt && !confirm(t('Stop charging {client}? Plays are recorded at ₾0 while this is on.', { client: client.company_name }))) return
    setSavingExempt(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/billing-exempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, exempt }),
      })
      const result = await res.json()
      if (!res.ok) {
        setMessage({ ok: false, text: result.error || t('Could not change billing for this account') })
        return
      }
      setClient({ ...client, billing_exempt: exempt })
      const resumed = result.reactivated
        ? ' ' + t('{n} campaign(s) resumed on {devices} device(s).', { n: result.reactivated, devices: result.devicesSynced })
        : ''
      setMessage({ ok: true, text: (exempt ? t('This account is no longer charged.') : t('This account is charged again.')) + resumed })
      void load()
    } catch {
      setMessage({ ok: false, text: t('Could not reach the server') })
    } finally {
      setSavingExempt(false)
    }
  }

  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>{t('Could not load this page from the database. Please try again.')}</p>
        <button type="button" className="portal-btn-primary" onClick={() => void load()}>{t('Try again')}</button>
      </div>
    </div>
  )

  // After an action the page refreshes in place; only the first load blanks it.
  if (loading && !client) return <div className="portal-loading">{t('Loading…')}</div>
  if (!client) return <div className="portal-loading">{t('Client not found')}</div>

  const balance = Number(client.balance ?? 0)
  const showPrice = campaigns.some((c) => c.monthly_price)
  const showDates = campaigns.some((c) => c.start_date || c.end_date)
  const toppedUp = transactions
    .filter(tx => tx.amount > 0)
    .reduce((sum, tx) => sum + Number(tx.amount), 0)
  const activeCount = campaigns.filter(c => c.status === 'active').length

  return (
    <div className="portal-page">
      <Link href="/admin/clients" className="portal-back-link">
        <ArrowLeft size={16} /> {t('Clients')}
      </Link>

      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{client.company_name}</h1>
          <p className="portal-subtitle">
            {[client.contact_name, client.email, client.phone].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <div className="overview-grid overview-grid-tools">
        <section className="balance-card" data-tone={balance <= 0 && !client.billing_exempt ? 'danger' : 'ok'}>
          <div className="balance-card-top">
            <span className="balance-card-label">{t('Balance')}</span>
          </div>
          <div className="balance-card-value">
            {gelParts(balance).sign}<span className="balance-card-currency">₾</span>{gelParts(balance).amount}
          </div>
          {/* Internal accounts use the test balance below instead of top-ups. */}
          {!client.billing_exempt && (
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
                placeholder={t('Amount, ₾')}
                aria-label={t('Amount in lari')}
              />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('Note (optional), e.g. invoice number')}
                aria-label={t('Note')}
                maxLength={500}
              />
              <div className="balance-form-actions">
                <button type="submit" className="portal-btn-primary" disabled={saving}>
                  <Plus size={15} aria-hidden /> {t('Add')}
                </button>
                <button type="button" className="portal-btn-secondary" disabled={saving} onClick={() => adjust(-1)}>
                  <Minus size={15} aria-hidden /> {t('Deduct')}
                </button>
              </div>
            </form>
          )}
          {message && (
            <p className="balance-card-note" role="status" style={{ color: message.ok ? 'var(--portal-success)' : 'var(--portal-danger)' }}>
              {message.text}
            </p>
          )}
          <label className="exempt-toggle">
            <input
              type="checkbox"
              checked={!!client.billing_exempt}
              disabled={savingExempt}
              onChange={(e) => void setExempt(e.target.checked)}
            />
            <span>
              <strong>{t('Internal account, never charged')}</strong>
              <small>{t('For staff and test accounts. Ads play and plays are recorded at ₾0, so the balance never runs out.')}</small>
            </span>
          </label>
          {client.billing_exempt && (
            <TestBalanceBox
              clientId={client.id}
              labels={{
                title: t('Test balance'),
                hint: t('Sets the balance to exactly this amount. It stays there, because this account is never charged.'),
                amount: t('Test balance in lari'),
                set: t('Set balance'),
                done: t('Balance set to {amount}.'),
                failed: t('Could not set the test balance'),
              }}
              onSaved={() => void load()}
            />
          )}
        </section>

        <div className="overview-side">
          <div className="stat-card">
            <div className="stat-card-info">
              <span className="stat-card-value">
                {activeCount}<span className="stat-card-of"> / {campaigns.length}</span>
              </span>
              <span className="stat-card-label">{t('Active campaigns')}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-info">
              <span className="stat-card-value">{gel(toppedUp)}</span>
              <span className="stat-card-label">{t('Topped up')}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-info">
              <span className="stat-card-value">{gel(spent)}</span>
              <span className="stat-card-label">{t('Spent on airtime')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="portal-section">
        <h2>{t('Campaigns')}</h2>
        {campaigns.length === 0 ? (
          <div className="portal-empty portal-empty-sm"><p>{t('No campaigns yet.')}</p></div>
        ) : (
          <div className="campaigns-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>{t('Name')}</th>
                  <th>{t('Status')}</th>
                  {showDates && <th>{t('Dates')}</th>}
                  {showPrice && <th>{t('Price')}</th>}
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
                    {showDates && (
                      <td className="cell-nowrap">
                        {c.start_date || c.end_date ? `${c.start_date || '…'} → ${c.end_date || '…'}` : <span className="cell-sub">{t('No end date')}</span>}
                      </td>
                    )}
                    {showPrice && <td>{c.monthly_price ? t('₾{amount}/mo', { amount: c.monthly_price }) : '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="portal-section">
        <h2>{t('Balance history')}</h2>
        {transactions.length === 0 ? (
          <div className="portal-empty portal-empty-sm"><p>{t('No top-ups or adjustments yet.')}</p></div>
        ) : (
          <div className="campaigns-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>{t('Date')}</th>
                  <th>{t('Type')}</th>
                  <th>{t('Note')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Amount')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Balance after')}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="cell-nowrap">
                      {new Date(tx.created_at).toLocaleDateString(locale, { timeZone: 'Asia/Tbilisi', year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td>{TRANSACTION_LABELS[tx.type] ? t(TRANSACTION_LABELS[tx.type]) : tx.type}</td>
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
