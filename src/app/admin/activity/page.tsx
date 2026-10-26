'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, BellRing, ChevronDown, Megaphone, Monitor, Receipt, RefreshCw, Search, Wallet, type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  buildActivity, type ActivityCategory, type ActivityItem, type AlertRow, type EventRow, type StatusRow, type TransactionRow,
} from '@/lib/activity'
import { useAdminText } from '@/lib/admin-i18n'

type Range = '24h' | '7d' | '30d'
const RANGE_HOURS: Record<Range, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 }
const RANGE_LABEL: Record<Range, string> = { '24h': 'last 24 hours', '7d': 'last 7 days', '30d': 'last 30 days' }

const CATEGORIES: { key: ActivityCategory | 'all'; label: string; icon?: LucideIcon }[] = [
  { key: 'all', label: 'All' },
  { key: 'screen', label: 'Screens', icon: Monitor },
  { key: 'billing', label: 'Billing', icon: Receipt },
  { key: 'campaign', label: 'Campaigns', icon: Megaphone },
  { key: 'balance', label: 'Balance', icon: Wallet },
  { key: 'alert', label: 'Alerts', icon: BellRing },
]

const ICONS: Record<ActivityCategory, LucideIcon> = {
  screen: Monitor, billing: Receipt, campaign: Megaphone, balance: Wallet, alert: BellRing,
}

const LIVE_MS = 30_000
const TZ = 'Asia/Tbilisi'

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

// The overview and Devices page link here with ?device=…; the first render is
// the loading state on server and client, so reading the URL can't mismatch.
function initialDevice() {
  if (typeof window === 'undefined') return ''
  return new URLSearchParams(window.location.search).get('device') ?? ''
}

function dayLabel(iso: string, now: number, t: (en: string, vars?: Record<string, string>) => string, locale: string) {
  const day = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ })
  const d = day(new Date(iso).getTime())
  const pretty = new Date(iso).toLocaleDateString(locale, { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
  if (d === day(now)) return t('Today · {date}', { date: pretty })
  if (d === day(now - 86_400_000)) return t('Yesterday · {date}', { date: pretty })
  return pretty
}

export default function ActivityPage() {
  const { t, locale } = useAdminText()
  const [items, setItems] = useState<ActivityItem[] | null>(null)
  const [missingTable, setMissingTable] = useState(false)
  const [error, setError] = useState('')
  const [range, setRange] = useState<Range>('7d')
  const [category, setCategory] = useState<ActivityCategory | 'all'>('all')
  const [query, setQuery] = useState(initialDevice)
  const [showQuiet, setShowQuiet] = useState(false)
  const [live, setLive] = useState(true)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [loadedAt, setLoadedAt] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const now = Date.now()
    const since = new Date(now - RANGE_HOURS[range] * 3_600_000).toISOString()

    const [events, statuses, transactions, alerts] = await Promise.all([
      supabase
        .from('system_events')
        .select('id, occurred_at, category, kind, severity, title, device_id, client_id, campaign_id, detail')
        .gte('occurred_at', since)
        .order('occurred_at', { ascending: false })
        .limit(2000),
      // The whole history (it's small) so each change knows the status before it.
      supabase
        .from('campaign_status_history')
        .select('id, campaign_id, status, changed_at, campaigns(name, clients(company_name))')
        .order('changed_at', { ascending: false })
        .limit(3000),
      supabase
        .from('balance_transactions')
        .select('id, created_at, client_id, amount, balance_after, type, note, created_by, clients!balance_transactions_client_id_fkey(company_name)')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase
        .from('billing_alerts')
        .select('id, created_at, kind, balance, sent_at, client_id, clients(company_name), campaigns(name)')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1000),
    ])

    if (statuses.error || transactions.error) {
      setError((statuses.error || transactions.error)?.message ?? t('Could not load activity'))
      setLoading(false)
      return
    }
    setError('')
    // Before the system_events migration the rest of the log still works.
    setMissingTable(Boolean(events.error))

    const actorIds = [...new Set((transactions.data || []).map((t) => t.created_by).filter(Boolean))] as string[]
    const actors = new Map<string, string>()
    if (actorIds.length) {
      const { data } = await supabase.from('clients').select('id, contact_name, company_name').in('id', actorIds)
      for (const a of data || []) actors.set(a.id, a.contact_name || a.company_name)
    }

    const built = buildActivity({
      events: (events.data || []) as EventRow[],
      statuses: (statuses.data || []).map((s) => {
        const campaign = one(s.campaigns as unknown as { name: string; clients: unknown } | null)
        const client = one(campaign?.clients as { company_name: string } | null)
        return { id: s.id, campaign_id: s.campaign_id, status: s.status, changed_at: s.changed_at, campaign: campaign?.name ?? null, client: client?.company_name ?? null } satisfies StatusRow
      }),
      transactions: (transactions.data || []).map((t) => ({
        id: t.id,
        created_at: t.created_at,
        client_id: t.client_id,
        amount: Number(t.amount),
        balance_after: t.balance_after === null ? null : Number(t.balance_after),
        type: t.type,
        note: t.note,
        client: one(t.clients as unknown as { company_name: string } | null)?.company_name ?? null,
        actor: t.created_by ? actors.get(t.created_by) ?? null : null,
      }) satisfies TransactionRow),
      alerts: alerts.error ? [] : (alerts.data || []).map((a) => ({
        id: a.id,
        created_at: a.created_at,
        kind: a.kind,
        balance: a.balance === null ? null : Number(a.balance),
        sent_at: a.sent_at,
        client_id: a.client_id,
        client: one(a.clients as unknown as { company_name: string } | null)?.company_name ?? null,
        campaign: one(a.campaigns as unknown as { name: string } | null)?.name ?? null,
      }) satisfies AlertRow),
    }, t).filter((item) => item.at >= since)

    setItems(built)
    setLoadedAt(now)
    setLoading(false)
  }, [range, t])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() is async: it fetches, then sets state
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => { void load() }, LIVE_MS)
    return () => window.clearInterval(id)
  }, [live, load])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? []).filter((item) =>
      (category === 'all' || item.category === category) &&
      (showQuiet || !item.quiet || category === 'billing') &&
      (!q || item.searchText.includes(q)),
    )
  }, [items, category, showQuiet, query])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 }
    for (const item of items ?? []) {
      if (item.quiet && !showQuiet) continue
      c.all++
      c[item.category] = (c[item.category] ?? 0) + 1
    }
    return c
  }, [items, showQuiet])

  const summary = useMemo(() => {
    const all = items ?? []
    const runs = all.filter((i) => i.id.startsWith('e') && i.category === 'billing')
    const charged = all
      .filter((i) => i.category === 'billing' && i.id.startsWith('t'))
      .reduce((sum, i) => sum + (i.amount ?? 0), 0)
    return {
      charged,
      runs: runs.length,
      failedRuns: runs.filter((i) => i.severity === 'error').length,
      drops: all.filter((i) => i.kind === 'disconnected').length,
      changes: all.filter((i) => i.category === 'campaign').length,
    }
  }, [items])

  const groups = useMemo(() => {
    const out: { label: string; items: ActivityItem[] }[] = []
    for (const item of visible) {
      const label = dayLabel(item.at, loadedAt, t, locale)
      const last = out[out.length - 1]
      if (last?.label === label) last.items.push(item)
      else out.push({ label, items: [item] })
    }
    return out
  }, [visible, loadedAt, t, locale])

  const toggle = (id: string) => setOpen((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  if (items === null && !error) return <div className="portal-loading">{t('Loading activity…')}</div>

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{t('Activity')}</h1>
          <p className="portal-subtitle">
            {t('Everything that happened across screens, billing, campaigns and balances. Times are Tbilisi time.')}
          </p>
        </div>
        <div className="admin-header-actions">
          <button
            type="button"
            className="portal-btn-secondary"
            aria-pressed={live}
            onClick={() => setLive((v) => !v)}
            title={live ? t('Refreshing every {n} seconds', { n: LIVE_MS / 1000 }) : t('Live updates paused')}
          >
            <span className="live-dot" data-on={live || undefined} aria-hidden /> {live ? t('Live') : t('Paused')}
          </button>
          <button type="button" className="portal-btn-secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} aria-hidden className={loading ? 'spin' : undefined} /> {t('Refresh')}
          </button>
        </div>
      </div>

      {error && <div className="portal-alert portal-alert-danger" role="alert">{t('Could not load activity')}: {error}</div>}
      {missingTable && (
        <div className="portal-alert portal-alert-warning">
          {t('Billing runs and screen events start appearing once the activity migration is applied. Campaign, balance and alert history below is complete.')}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-value">₾{summary.charged.toFixed(2)}</span>
            <span className="stat-card-label">{t('Charged in the {range}', { range: t(RANGE_LABEL[range]) })}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-value" style={summary.failedRuns ? { color: 'var(--portal-danger)' } : undefined}>
              {summary.runs}
              {summary.failedRuns > 0 && <span className="stat-card-of"> · {t('{n} failed', { n: summary.failedRuns })}</span>}
            </span>
            <span className="stat-card-label">{t('Billing runs')}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-value">{summary.drops}</span>
            <span className="stat-card-label">{t('Screen disconnections')}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-value">{summary.changes}</span>
            <span className="stat-card-label">{t('Campaign status changes')}</span>
          </div>
        </div>
      </div>

      <div className="activity-toolbar">
        <div className="admin-filters" role="tablist" aria-label={t('Area')}>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={category === c.key}
              className={`admin-filter-btn ${category === c.key ? 'active' : ''}`}
              onClick={() => setCategory(c.key)}
            >
              {c.icon && <c.icon size={14} aria-hidden />}
              {t(c.label)}
              <span className="filter-count">{counts[c.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="segmented activity-range" role="group" aria-label={t('Time range')}>
          {(Object.keys(RANGE_HOURS) as Range[]).map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>
              {r === '24h' ? t('24 h') : r === '7d' ? t('7 days') : t('30 days')}
            </button>
          ))}
        </div>
      </div>

      <div className="activity-subbar">
        <label className="search-field">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search screen, client, campaign')}
            aria-label={t('Search activity')}
          />
        </label>
        <label className="activity-quiet">
          <input type="checkbox" checked={showQuiet} onChange={(e) => setShowQuiet(e.target.checked)} />
          {t('Show billing runs that charged nothing')}
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="portal-empty portal-empty-sm">
          <p>{category !== 'all' || query ? t('Nothing in the {range} for these filters.', { range: t(RANGE_LABEL[range]) }) : t('Nothing in the {range}.', { range: t(RANGE_LABEL[range]) })}</p>
        </div>
      ) : (
        <div className="activity-days">
          {groups.map((group) => (
            <section key={group.label} className="activity-day">
              <h2 className="activity-day-label">{group.label}</h2>
              <ol className="activity-list">
                {group.items.map((item) => {
                  const Icon = item.severity === 'error' ? AlertTriangle : ICONS[item.category]
                  const expanded = open.has(item.id)
                  const hasDetail = item.detail.length > 0
                  return (
                    <li key={item.id} className="activity-item" data-severity={item.severity}>
                      <button
                        type="button"
                        className="activity-row"
                        onClick={() => hasDetail && toggle(item.id)}
                        aria-expanded={hasDetail ? expanded : undefined}
                        disabled={!hasDetail}
                      >
                        <time className="activity-time" dateTime={item.at}>
                          {new Date(item.at).toLocaleTimeString(locale, { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </time>
                        <span className="activity-icon" aria-hidden><Icon size={15} /></span>
                        <span className="activity-text">
                          <span className="activity-title">{item.title}</span>
                          {item.subtitle && <span className="cell-sub">{item.subtitle}</span>}
                        </span>
                        <span className="activity-tag">{t(CATEGORIES.find((c) => c.key === item.category)?.label ?? '')}</span>
                        {hasDetail && <ChevronDown size={16} aria-hidden className="activity-chevron" />}
                      </button>
                      {expanded && (
                        <div className="activity-detail">
                          <dl>
                            {item.detail.map(([label, value]) => (
                              <div key={label}>
                                <dt>{label}</dt>
                                <dd>{value}</dd>
                              </div>
                            ))}
                          </dl>
                          {item.href && <Link href={item.href} className="section-link">{t('Open')}</Link>}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {loadedAt > 0 && (
        <p className="field-hint" style={{ marginTop: 18 }}>
          {t('Updated {time}', { time: new Date(loadedAt).toLocaleTimeString(locale, { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' }) })}
          {live ? `, ${t('refreshing every {n} seconds', { n: LIVE_MS / 1000 })}` : ''}.
        </p>
      )}
    </div>
  )
}
