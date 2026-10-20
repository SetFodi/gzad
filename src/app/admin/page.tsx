'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle, ArrowRight, BellRing, CheckCircle2, FileImage, Megaphone, Monitor, Play, Users, WalletMinimal,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { readAllRows } from '@/lib/supabase/read'
import StatusBadge from '@/components/app/StatusBadge'

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
  lastPlayAgo: string | null
  today: string
  devices: number
  recent: RecentCampaign[]
}

// Screens report a play every few seconds while on air; an hour of silence
// means none of them is playing or their reports aren't arriving.
const SILENCE_MS = 60 * 60 * 1000

function timeAgo(iso: string, now: number) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}

export default function AdminOverview() {
  const [data, setData] = useState<Overview | null>(null)
  const [online, setOnline] = useState<number | null>(null)
  const [loadError, setLoadError] = useState(false)

  const load = useCallback(async () => {
    setData(null)
    setOnline(null)
    setLoadError(false)
    try {
      const supabase = createClient()
      const now = Date.now()
      const since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [clients, active, pending, pendingMedia, plays, depleted, alerts, lastPlay, devices, recent] = await Promise.all([
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
        lastPlayAgo: lastPlay.data?.[0] ? timeAgo(lastPlay.data[0].began_at, now) : null,
        today: new Date(now).toLocaleDateString('en-GB', { timeZone: 'Asia/Tbilisi', weekday: 'long', day: 'numeric', month: 'long' }),
        devices: devices.count ?? 0,
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
        if (res.ok && !list.realtimeError) setOnline(items.filter(d => d.online).length)
      } catch {
        setOnline(null)
      }
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>Could not load this page from the database. Please try again.</p>
        <button type="button" className="portal-btn-primary" onClick={() => void load()}>Try again</button>
      </div>
    </div>
  )

  if (!data) return <div className="portal-loading">Loading…</div>

  const attention = [
    data.pendingCampaigns > 0 && {
      icon: Megaphone,
      tone: 'warning',
      text: `${data.pendingCampaigns} ${data.pendingCampaigns === 1 ? 'campaign is' : 'campaigns are'} waiting for review`,
      href: '/admin/campaigns?status=pending_review',
    },
    data.pendingMedia > 0 && {
      icon: FileImage,
      tone: 'warning',
      text: `${data.pendingMedia} media ${data.pendingMedia === 1 ? 'file' : 'files'} to review`,
      href: '/admin/campaigns?status=pending_review',
    },
    data.depleted.length > 0 && {
      icon: WalletMinimal,
      tone: 'danger',
      text: `${data.depleted.length} ${data.depleted.length === 1 ? 'client is' : 'clients are'} out of balance: ${data.depleted.slice(0, 3).map(c => c.company_name).join(', ')}${data.depleted.length > 3 ? '…' : ''}`,
      href: '/admin/clients',
    },
    !!data.openAlerts && {
      icon: BellRing,
      tone: 'warning',
      text: `${data.openAlerts} billing ${data.openAlerts === 1 ? 'alert' : 'alerts'} this week (low balance or daily cap)`,
      href: '/admin/clients',
    },
    data.silent && {
      icon: AlertTriangle,
      tone: 'danger',
      text: data.lastPlayAt
        ? `No plays received since ${new Date(data.lastPlayAt).toLocaleString('en-GB', { timeZone: 'Asia/Tbilisi', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} (${data.lastPlayAgo})`
        : 'No plays have been received yet',
      href: '/admin/logs',
    },
  ].filter(Boolean) as { icon: typeof Megaphone; tone: string; text: string; href: string }[]

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">Overview</h1>
          <p className="portal-subtitle">{data.today}</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-info)' }}>
            <Users size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{data.clients}</span>
            <span className="stat-card-label">Clients</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-success)' }}>
            <Megaphone size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{data.activeCampaigns}</span>
            <span className="stat-card-label">Active campaigns</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-primary)' }}>
            <Play size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{data.totalPlays.toLocaleString()}</span>
            <span className="stat-card-label">Plays, all time</span>
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
            <span className="stat-card-label">Screens online</span>
          </div>
        </Link>
      </div>

      <div className="overview-columns">
        <section className="portal-section">
          <h2>Needs attention</h2>
          <ul className="attention-list">
            {attention.length === 0 ? (
              <li className="attention-row" data-tone="ok">
                <span className="attention-icon"><CheckCircle2 size={18} aria-hidden /></span>
                <span className="attention-text">All clear. Nothing is waiting on you.</span>
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
            <h2>Recent campaigns</h2>
            <Link href="/admin/campaigns" className="section-link">
              All campaigns <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          <div className="campaigns-table-wrapper">
            {data.recent.length === 0 ? (
              <p className="portal-empty-text" style={{ padding: 20 }}>No campaigns yet.</p>
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
