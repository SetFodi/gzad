'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { readAllRows } from '@/lib/supabase/read'
import { useTranslations } from '@/lib/i18n'
import { AlertTriangle, Receipt, WalletCards, Wallet } from 'lucide-react'

/** One hour of one campaign on one taxi; ten-minute blocks fold into it. */
interface HourCharge {
  key: string
  hour_start: string
  device_id: string
  district: string | null
  total_cost: number
  coverage: number | null
  campaign_name: string | null
}

interface BalanceTransaction {
  id: string
  amount: number
  balance_after: number | null
  type: string
  note: string | null
  created_at: string
}

interface StoredBillingAlert {
  id: string
  kind: 'low_20pct' | 'runway_1d' | 'depleted' | 'cap_reached'
  balance: number | string | null
  detail: { date?: string; pct?: number } | null
  created_at: string
  campaigns: { name?: string } | { name?: string }[] | null
}

const tbilisiDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' })

export default function BillingPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [charges, setCharges] = useState<HourCharge[]>([])
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([])
  const [spent30, setSpent30] = useState(0)
  const [avgDailySpend, setAvgDailySpend] = useState<number | null>(null)
  const [cappedToday, setCappedToday] = useState<string[]>([])
  const [balanceAlerts, setBalanceAlerts] = useState<StoredBillingAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { t } = useTranslations()
  const p = t.portal.billing
  const c = t.portal.common

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const supabase = createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw authError ?? new Error('Not authenticated')

        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('id, balance')
          .eq('auth_user_id', user.id)
          .single()

        if (clientError || !client) throw clientError ?? new Error('Client profile unavailable')

        const amount = Number(client.balance)
        if (client.balance === null || client.balance === undefined || !Number.isFinite(amount)) throw new Error('Balance unavailable')

        const now = new Date()
        const thirtyDaysAgo = tbilisiDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
        const weekAgo = tbilisiDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
        const today = tbilisiDay(now)

        const [hourly, daily, alerts, txData] = await Promise.all([
          supabase
            .from('billing_hourly')
            .select('campaign_id, campaign_name, device_id, hour_start, district, total_cost, coverage')
            .eq('client_id', client.id)
            .order('hour_start', { ascending: false })
            .limit(50),
          readAllRows<{ day: string; total_cost: number }>((from, to) => supabase
            .from('billing_daily_totals')
            .select('day, total_cost')
            .eq('client_id', client.id)
            .gte('day', thirtyDaysAgo).order('day').order('campaign_id').range(from, to)),
          readAllRows<StoredBillingAlert>((from, to) => supabase
            .from('billing_alerts')
            .select('id, kind, balance, detail, created_at, campaigns(name)')
            .eq('client_id', client.id)
            .is('dismissed_at', null)
            .order('created_at', { ascending: false }).order('id').range(from, to)),
          readAllRows<BalanceTransaction>((from, to) => supabase
            .from('balance_transactions')
            .select('id, amount, balance_after, type, note, created_at')
            .eq('client_id', client.id)
            .neq('type', 'billing')
            .order('created_at', { ascending: false }).order('id').range(from, to)),
        ])

        if (!active) return
        setBalance(amount)
        setAvgDailySpend(null)
        if (!hourly.error) {
          setCharges((hourly.data || []).map((h) => ({
            key: `${h.campaign_id}|${h.device_id}|${h.hour_start}`,
            hour_start: h.hour_start,
            device_id: h.device_id,
            district: h.district,
            total_cost: Number(h.total_cost),
            coverage: h.coverage === null ? null : Number(h.coverage),
            campaign_name: h.campaign_name,
          })))

          const perDay = new Map<string, number>()
          for (const d of daily) perDay.set(d.day, (perDay.get(d.day) ?? 0) + Number(d.total_cost))
          setSpent30([...perDay.values()].reduce((sum, v) => sum + v, 0))
          const week = [...perDay.entries()].filter(([day, v]) => day >= weekAgo && day < today && v > 0)
          setAvgDailySpend(week.length ? week.reduce((sum, [, v]) => sum + v, 0) / week.length : null)
        } else {
          // Before migration 010 the views don't exist yet: read the raw rows.
          const thirty = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
          const [chargeResult, spendData] = await Promise.all([
            supabase
              .from('billing_logs')
              .select('id, period_start, device_id, district, total_cost, campaigns(name)')
              .eq('client_id', client.id)
              .order('period_start', { ascending: false })
              .limit(50),
            readAllRows<{ total_cost: number }>((from, to) => supabase.from('billing_logs').select('total_cost').eq('client_id', client.id).gte('period_start', thirty).order('id').range(from, to)),
          ])
          if (chargeResult.error) throw chargeResult.error
          if (!active) return
          const chargeData = chargeResult.data
          setCharges((chargeData || []).map((l) => {
            const campaign = (Array.isArray(l.campaigns) ? l.campaigns[0] : l.campaigns) as { name?: string } | null
            return {
              key: l.id,
              hour_start: l.period_start,
              device_id: l.device_id,
              district: l.district,
              total_cost: Number(l.total_cost),
              coverage: null,
              campaign_name: campaign?.name ?? null,
            }
          }))
          setSpent30((spendData || []).reduce((sum, r) => sum + Number(r.total_cost), 0))
        }

        {
          setCappedToday(alerts.filter(a => a.kind === 'cap_reached' && a.detail?.date === today).map((a) => {
            const campaign = (Array.isArray(a.campaigns) ? a.campaigns[0] : a.campaigns) as { name?: string } | null
            return campaign?.name ?? ''
          }).filter(Boolean))
          const lastTopup = txData.find(tx => tx.type === 'topup')?.created_at
          setBalanceAlerts(alerts.filter(a => a.kind !== 'cap_reached' && (!lastTopup || a.created_at >= lastTopup)))
        }

        setTransactions(txData || [])
      } catch {
        if (active) setLoadError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [attempt])

  if (loading) return <div className="portal-loading">{c.loading}</div>

  if (loadError) return (
    <div className="portal-page">
      <h1 className="portal-page-title">{p.title}</h1>
      <div className="portal-alert portal-alert-error" role="alert">{c.loadError}</div>
      <button type="button" className="portal-btn-primary" onClick={() => { setLoadError(false); setLoading(true); setAttempt(value => value + 1) }}>{c.retry}</button>
    </div>
  )

  const toppedUp = transactions
    .filter(tx => tx.amount > 0)
    .reduce((sum, tx) => sum + Number(tx.amount), 0)

  const runwayDays = avgDailySpend && balance !== null ? balance / avgDailySpend : null
  const banners: string[] = []
  if ((balance ?? 0) <= 0) banners.push(p.depleted)
  else {
    const low = balanceAlerts.find(a => a.kind === 'low_20pct' && Number(a.detail?.pct) > 0)
    if (low) banners.push(p.lowBalanceAlert.replace('{pct}', String(low.detail?.pct)).replace('{balance}', (balance ?? 0).toFixed(2)))
    if (balanceAlerts.some(a => a.kind === 'runway_1d') || (runwayDays !== null && runwayDays < 1)) banners.push(p.runwaySoon)
    else if (runwayDays !== null && runwayDays < 3) banners.push(p.runway.replace('{days}', runwayDays.toFixed(1)))
  }
  for (const name of cappedToday) banners.push(p.capReached.replace('{campaign}', name))

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{p.title}</h1>
          <p className="portal-subtitle">{p.subtitle}</p>
        </div>
      </div>

      {banners.map((text) => (
        <div key={text} role="status" className="portal-alert portal-alert-warning" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} aria-hidden style={{ flexShrink: 0 }} />
          {text}
        </div>
      ))}

      <div className="stats-grid three-col">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: (balance ?? 0) > 0 ? 'var(--portal-success)' : 'var(--portal-danger)' }}>
            <Wallet size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value" style={{ color: (balance ?? 0) > 0 ? 'var(--portal-text)' : 'var(--portal-danger)' }}>
              ₾{(balance ?? 0).toFixed(2)}
            </span>
            <span className="stat-card-label">{p.balance}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-warning)' }}>
            <Receipt size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">₾{spent30.toFixed(2)}</span>
            <span className="stat-card-label">{p.spent30}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-success)' }}>
            <WalletCards size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">₾{toppedUp.toFixed(2)}</span>
            <span className="stat-card-label">{p.toppedUp}</span>
          </div>
        </div>
      </div>

      <p className="field-hint" style={{ marginTop: 12 }}>{p.balanceHint}</p>

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
                  <th style={{ textAlign: 'right' }}>{p.coverage}</th>
                  <th style={{ textAlign: 'right' }}>{p.cost}</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((l) => (
                  <tr key={l.key}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                      {new Date(l.hour_start).toLocaleString('en-GB', { timeZone: 'Asia/Tbilisi', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>{l.campaign_name || '—'}</td>
                    <td>{l.district || '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--portal-muted)', fontSize: 13 }}>
                      {l.coverage === null ? '—' : `${Math.round(l.coverage * 100)}%`}
                    </td>
                    <td style={{ textAlign: 'right' }}>₾{l.total_cost.toFixed(2)}</td>
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
                    <td>{p.txTypes[tx.type as keyof typeof p.txTypes] || tx.type}</td>
                    <td style={{ color: 'var(--portal-muted)', fontSize: 13 }}>{tx.note || '—'}</td>
                    <td style={{
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: tx.amount > 0 ? 'var(--portal-success)' : 'var(--portal-danger)',
                    }}>
                      {tx.amount > 0 ? '+' : '−'}₾{Math.abs(Number(tx.amount)).toFixed(2)}
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
