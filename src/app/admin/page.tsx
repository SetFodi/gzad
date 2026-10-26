'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowRight, BellRing, CheckCircle2, FileImage, Megaphone, Monitor, Play, Receipt, Server, Users, WalletMinimal,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { readAllRows } from '@/lib/supabase/read'
import StatusBadge from '@/components/app/StatusBadge'
import { useAdminText } from '@/lib/admin-i18n'

interface RecentCampaign {
  id: string
  name: string
  status: string
  created_at: string
  company_name: string
}

interface Overview {
  clients: number
  activeCampaigns: number
  totalPlays: number
  pendingCampaigns: number
  pendingMedia: number
  depleted: { id: string; company_name: string }[]
  openAlerts: number | null
  lastPlayAt: string | null
  /** No play for SILENCE_MS; worked out at load time, not during render. */
  silent: boolean
  /** When this data was loaded; times are worded at render in the chosen language. */
  now: number
  devices: number
  recent: RecentCampaign[]
  /** Last billing run from the activity log; null before that migration or any run. */
  billing: { at: string; failed: boolean; stale: boolean; title: string } | null
  /** When money last moved: runs every 15 min often have nothing to charge. */
  lastChargeAt: string | null
}

// Screens report a play every few seconds while on air; an hour of silence
// means none of them is playing or their reports aren't arriving.
const SILENCE_MS = 60 * 60 * 1000
// The realtime server triggers billing every 15 minutes; two missed runs is a problem.
const BILLING_STALE_MS = 35 * 60 * 1000

function timeAgo(iso: string, now: number, t: (en: string, vars?: Record<string, number>) => string) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000)
  if (minutes < 60) return t('{n} min ago', { n: minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 48) return t('{n} h ago', { n: hours })
  return t('{n} days ago', { n: Math.round(hours / 24) })
}

export default function AdminOverview() {
  const { t, locale } = useAdminText()
  const [data, setData] = useState<Overview | null>(null)
  const [online, setOnline] = useState<number | null>(null)
  const [realtimeOk, setRealtimeOk] = useState<boolean | null>(null)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    setData(null)
    setOnline(null)
    setLoadError(false)
    try {
      const supabase = createClient()
      const now = Date.now()
      const since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [clients, active, pending, pendingMedia, plays, depleted, alerts, lastPlay, devices, recent, lastRun, lastCharge] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('is_admin', false).neq('role', 'fleet'),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
        supabase.from('ad_media').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
        readAllRows<{ play_count: number }>((from, to) => supabase.from('play_stats').select('play_count').order('id').range(from, to)),
        // Clients whose credit has run out — their ads are paused until topped up.
        supabase.from('clients').select('id, company_name').eq('is_admin', false).neq('role', 'fleet').lte('balance', 0),
        // Billing alerts must load successfully before the overview is trusted.
        supabase.from('billing_alerts').select('*', { count: 'exact', head: true }).is('dismissed_at', null).gte('created_at', since),
        supabase.from('play_logs').select('began_at').order('began_at', { ascending: false }).limit(1),
        supabase.from('devices').select('*', { count: 'exact', head: true }),
        supabase.from('campaigns').select('id, name, status, created_at, clients(company_name)').order('created_at', { ascending: false }).limit(6),
        // Optional: the activity log may not exist yet, so it isn't in failedRead.
        supabase.from('system_events').select('occurred_at, severity, title').eq('category', 'billing').order('occurred_at', { ascending: false }).limit(1),
        supabase.from('billing_logs').select('created_at').order('created_at', { ascending: false }).limit(1),
      ])

      const failedRead = [clients, active, pending, pendingMedia, depleted, alerts, lastPlay, devices, recent].find(result => result.error)
      if (failedRead) throw failedRead.error

      setData({
        clients: clients.count ?? 0,
        activeCampaigns: active.count ?? 0,
        totalPlays: plays.reduce((sum, row) => sum + Number(row.play_count), 0),
        pendingCampaigns: pending.count ?? 0,
        pendingMedia: pendingMedia.count ?? 0,
        depleted: depleted.data ?? [],
        openAlerts: alerts.count ?? 0,
        lastPlayAt: lastPlay.data?.[0]?.began_at ?? null,
        silent: !lastPlay.data?.[0] || now - new Date(lastPlay.data[0].began_at).getTime() > SILENCE_MS,
        now,
        devices: devices.count ?? 0,
        billing: lastRun.data?.[0]
          ? {
            at: lastRun.data[0].occurred_at,
            failed: lastRun.data[0].severity === 'error',
            stale: now - new Date(lastRun.data[0].occurred_at).getTime() > BILLING_STALE_MS,
            title: lastRun.data[0].title,
          }
          : null,
        lastChargeAt: lastCharge.data?.[0]?.created_at ?? null,
        recent: (recent.data || []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          status: c.status as string,
          created_at: c.created_at as string,
          company_name: (c.clients as { company_name: string } | null)?.company_name || '—',
        })),
      })

      // Online status comes from the Realtime Server, which can be slow or down.
      try {
        const res = await fetch('/api/devices')
        const list = await res.json()
        const items: { online?: boolean }[] = Array.isArray(list) ? list : list.devices || []
        setRealtimeOk(res.ok && !list.realtimeError)
        if (res.ok && !list.realtimeError) setOnline(items.filter(d => d.online).length)
      } catch {
        setOnline(null)
        setRealtimeOk(false)
      }
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>{t('Could not load this page from the database. Please try again.')}</p>
        <button type="button" className="portal-btn-primary" onClick={() => void load()}>{t('Try again')}</button>
      </div>
    </div>
  )

  if (!data) return <div className="portal-loading">{t('Loading…')}</div>

  const attention = [
    data.pendingCampaigns > 0 && {
      icon: Megaphone,
      tone: 'warning',
      text: data.pendingCampaigns === 1 ? t('1 campaign is waiting for review') : t('{n} campaigns are waiting for review', { n: data.pendingCampaigns }),
      href: '/admin/campaigns?status=pending_review',
    },
    data.pendingMedia > 0 && {
      icon: FileImage,
      tone: 'warning',
      text: data.pendingMedia === 1 ? t('1 media file to review') : t('{n} media files to review', { n: data.pendingMedia }),
      href: '/admin/campaigns?status=pending_review',
    },
    data.depleted.length > 0 && {
      icon: WalletMinimal,
      tone: 'danger',
      text: `${data.depleted.length === 1 ? t('1 client is out of balance') : t('{n} clients are out of balance', { n: data.depleted.length })}: ${data.depleted.slice(0, 3).map(c => c.company_name).join(', ')}${data.depleted.length > 3 ? '…' : ''}`,
      href: '/admin/clients',
    },
    !!data.openAlerts && {
      icon: BellRing,
      tone: 'warning',
      text: data.openAlerts === 1 ? t('1 billing alert this week (low balance or daily cap)') : t('{n} billing alerts this week (low balance or daily cap)', { n: data.openAlerts }),
      href: '/admin/clients',
    },
    data.billing?.failed && {
      icon: Receipt,
      tone: 'danger',
      text: t('The last billing run failed ({ago})', { ago: timeAgo(data.billing.at, data.now, t) }),
      href: '/admin/activity',
    },
    data.billing && !data.billing.failed && data.billing.stale && {
      icon: Receipt,
      tone: 'danger',
      text: t("Billing hasn't run since {ago}. Check the realtime server's billing trigger.", { ago: timeAgo(data.billing.at, data.now, t) }),
      href: '/admin/activity',
    },
    realtimeOk === false && {
      icon: Server,
      tone: 'danger',
      text: t("Can't reach the Realtime Server: screens can't be controlled and online status is unknown"),
      href: '/admin/devices',
    },
    data.silent && {
      icon: AlertTriangle,
      tone: 'danger',
      text: data.lastPlayAt
        ? t('No plays received since {when} ({ago})', {
          when: new Date(data.lastPlayAt).toLocaleString(locale, { timeZone: 'Asia/Tbilisi', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          ago: timeAgo(data.lastPlayAt, data.now, t),
        })
        : t('No plays have been received yet'),
      href: '/admin/logs',
    },
  ].filter(Boolean) as { icon: typeof Megaphone; tone: string; text: string; href: string }[]

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{t('Overview')}</h1>
          <p className="portal-subtitle">{new Date(data.now).toLocaleDateString(locale, { timeZone: 'Asia/Tbilisi', weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="system-status" aria-label={t('System status')}>
          <Link
            href="/admin/activity"
            className="system-pill"
            data-tone={!data.billing ? 'idle' : data.billing.failed || data.billing.stale ? 'danger' : 'ok'}
            title={t('Billing checks for new plays every 15 minutes and only charges when screens played ads')}
          >
            <span className="system-dot" aria-hidden />
            {data.billing ? t('Billing checked {ago}', { ago: timeAgo(data.billing.at, data.now, t) }) : t('Billing: no runs logged yet')}
            <span className="system-pill-sub">
              · {t('last charge')} {data.lastChargeAt
                ? new Date(data.lastChargeAt).toLocaleString(locale, { timeZone: 'Asia/Tbilisi', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : t('never')}
            </span>
          </Link>
          <Link href="/admin/devices" className="system-pill" data-tone={realtimeOk === null ? 'idle' : realtimeOk ? 'ok' : 'danger'}>
            <span className="system-dot" aria-hidden />
            {realtimeOk === null ? t('Realtime Server: checking…') : realtimeOk ? t('Realtime Server reachable') : t('Realtime Server unreachable')}
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-info)' }}>
            <Users size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{data.clients}</span>
            <span className="stat-card-label">{t('Clients')}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-success)' }}>
            <Megaphone size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{data.activeCampaigns}</span>
            <span className="stat-card-label">{t('Active campaigns')}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-primary)' }}>
            <Play size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{data.totalPlays.toLocaleString()}</span>
            <span className="stat-card-label">{t('Plays, all time')}</span>
          </div>
        </div>
        <Link href="/admin/devices" className="stat-card stat-card-link">
          <div className="stat-card-icon" style={{ color: online ? 'var(--portal-success)' : 'var(--portal-muted)' }}>
            <Monitor size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">
              {online === null ? '—' : online}
              <span className="stat-card-of"> / {data.devices}</span>
            </span>
            <span className="stat-card-label">{t('Screens online')}</span>
          </div>
        </Link>
      </div>

      <div className="overview-columns">
        <section className="portal-section">
          <h2>{t('Needs attention')}</h2>
          <ul className="attention-list">
            {attention.length === 0 ? (
              <li className="attention-row" data-tone="ok">
                <span className="attention-icon"><CheckCircle2 size={18} aria-hidden /></span>
                <span className="attention-text">{t('All clear. Nothing is waiting on you.')}</span>
              </li>
            ) : attention.map((item) => (
              <li key={item.text}>
                <Link href={item.href} className="attention-row" data-tone={item.tone}>
                  <span className="attention-icon"><item.icon size={18} aria-hidden /></span>
                  <span className="attention-text">{item.text}</span>
                  <ArrowRight size={16} className="attention-go" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="portal-section">
          <div className="section-head">
            <h2>{t('Recent campaigns')}</h2>
            <Link href="/admin/campaigns" className="section-link">
              {t('All campaigns')} <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          <div className="campaigns-table-wrapper">
            {data.recent.length === 0 ? (
              <p className="portal-empty-text" style={{ padding: 20 }}>{t('No campaigns yet.')}</p>
            ) : (
              <ul className="recent-list">
                {data.recent.map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/campaigns/${c.id}`} className="recent-row">
                      <span className="cell-stack">
                        <span className="recent-name">{c.name}</span>
                        <span className="cell-sub">{c.company_name}</span>
                      </span>
                      <StatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
