'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Clock, Megaphone, Play, Plus, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { readAllRows } from '@/lib/supabase/read'
import { useTranslations } from '@/lib/i18n'
import CampaignCard, { summariseMedia, type CampaignSummary } from '@/components/portal/CampaignCard'

function formatScreenTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const tbilisiDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' })

export default function DashboardPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [avgDailySpend, setAvgDailySpend] = useState<number | null>(null)
  const [totalPlays, setTotalPlays] = useState(0)
  const [totalScreenTime, setTotalScreenTime] = useState(0)
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { t } = useTranslations()
  const p = t.portal.dashboard
  const b = t.portal.billing
  const c = t.portal.common

  useEffect(() => {
    let active = true
    async function loadData() {
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

        const campaignsData = await readAllRows<CampaignSummary>((from, to) => supabase
          .from('campaigns')
          .select('*')
          .eq('client_id', client.id)
          .order('created_at', { ascending: false }).order('id').range(from, to))

        const campaignIds = campaignsData?.map(c => c.id) || []

        let plays = 0
        let screenTime = 0
        let media = new Map<string, { count: number; url?: string; type?: string }>()
        let dailySpend: number | null = null

        if (campaignIds.length > 0) {
          const now = new Date()
          const weekAgo = tbilisiDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
          const today = tbilisiDay(now)

          const [statsData, mediaRows, spendRows] = await Promise.all([
            readAllRows<{ play_count: number; total_duration_seconds: number | null }>((from, to) => supabase.from('play_stats').select('play_count, total_duration_seconds').in('campaign_id', campaignIds).order('id').range(from, to)),
            readAllRows<{ campaign_id: string; file_url: string; file_type: string | null }>((from, to) => supabase
              .from('ad_media')
              .select('campaign_id, file_url, file_type')
              .in('campaign_id', campaignIds)
              .order('uploaded_at', { ascending: true }).order('id').range(from, to)),
            readAllRows<{ day: string; total_cost: number }>((from, to) => supabase.from('billing_daily_totals').select('day, total_cost').eq('client_id', client.id).gte('day', weekAgo).lt('day', today).order('day').order('campaign_id').range(from, to)),
          ])

          plays = statsData?.reduce((sum, s) => sum + s.play_count, 0) || 0
          screenTime = statsData?.reduce((sum, s) => sum + (s.total_duration_seconds || 0), 0) || 0
          media = summariseMedia(mediaRows || [])

          if (plays === 0) {
            const rawLogs = await readAllRows<{ duration_seconds: number | null }>((from, to) => supabase
              .from('play_logs')
              .select('duration_seconds')
              .in('campaign_id', campaignIds).order('id').range(from, to))

            plays = rawLogs?.length || 0
            screenTime = rawLogs?.reduce((sum, l) => sum + (l.duration_seconds || 0), 0) || 0
          }

          // Estimate only from successfully loaded, actual spend days.
          {
            const perDay = new Map<string, number>()
            for (const d of spendRows) perDay.set(d.day, (perDay.get(d.day) ?? 0) + Number(d.total_cost))
            const days = [...perDay.values()].filter(v => v > 0)
            dailySpend = days.length ? days.reduce((a, v) => a + v, 0) / days.length : null
          }
        }

        if (!active) return
        setBalance(amount)
        setAvgDailySpend(dailySpend)
        setTotalPlays(plays)
        setTotalScreenTime(screenTime)
        setCampaigns((campaignsData || []).map(camp => {
          const m = media.get(camp.id)
          return { ...camp, media_count: m?.count ?? 0, first_media_url: m?.url, first_media_type: m?.type }
        }))
      } catch {
        if (active) setLoadError(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadData()
    return () => { active = false }
  }, [attempt])

  if (loading) {
    return <div className="portal-loading">{c.loading}</div>
  }

  if (loadError) return (
    <div className="portal-page">
      <h1 className="portal-page-title">{p.title}</h1>
      <div className="portal-alert portal-alert-error" role="alert">{c.loadError}</div>
      <button type="button" className="portal-btn-primary" onClick={() => { setLoadError(false); setLoading(true); setAttempt(value => value + 1) }}>{c.retry}</button>
    </div>
  )

  const activeCount = campaigns.filter(camp => camp.status === 'active').length
  const pendingCount = campaigns.filter(camp => camp.status === 'pending_review').length
  const amount = balance ?? 0
  const runwayDays = avgDailySpend && amount > 0 ? amount / avgDailySpend : null
  const balanceNote =
    amount <= 0 ? b.depleted
      : runwayDays !== null && runwayDays < 1 ? b.runwaySoon
        : runwayDays !== null && runwayDays < 14 ? b.runway.replace('{days}', runwayDays.toFixed(runwayDays < 3 ? 1 : 0))
          : p.balanceOk
  const balanceTone = amount <= 0 ? 'danger' : runwayDays !== null && runwayDays < 3 ? 'warning' : 'ok'

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{p.title}</h1>
          <p className="portal-subtitle">{p.subtitle}</p>
        </div>
        <Link href="/portal/dashboard/submit" className="portal-btn-primary">
          <Plus size={16} aria-hidden />
          {p.submitAd}
        </Link>
      </div>

      <div className="overview-grid">
        <section className="balance-card" data-tone={balanceTone}>
          <div className="balance-card-top">
            <span className="balance-card-label">
              <Wallet size={16} aria-hidden />
              {p.balance}
            </span>
            <Link href="/portal/dashboard/billing" className="balance-card-link">
              {p.billingDetails}
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          <div className="balance-card-value">
            <span className="balance-card-currency">₾</span>
            {amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="balance-card-note">{balanceNote}</p>
        </section>

        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-success)' }}>
            <Megaphone size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{activeCount}</span>
            <span className="stat-card-label">{p.activeCampaigns}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-info)' }}>
            <Play size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{totalPlays.toLocaleString()}</span>
            <span className="stat-card-label">{p.totalPlays}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-primary)' }}>
            <Clock size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{formatScreenTime(totalScreenTime)}</span>
            <span className="stat-card-label">{p.screenTime}</span>
          </div>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="portal-alert portal-alert-warning" role="status" style={{ marginTop: 20, marginBottom: 0 }}>
          {p.pendingNotice.replace('{count}', String(pendingCount))}
        </div>
      )}

      <div className="portal-section">
        <div className="section-head">
          <h2>{p.recentCampaigns}</h2>
          {campaigns.length > 6 && (
            <Link href="/portal/dashboard/campaigns" className="section-link">
              {p.viewAll}
              <ArrowRight size={14} aria-hidden />
            </Link>
          )}
        </div>
        {campaigns.length === 0 ? (
          <div className="portal-empty">
            <p>{p.noCampaigns}</p>
            <Link href="/portal/dashboard/submit" className="portal-btn-primary">
              <Plus size={16} aria-hidden />
              {p.submitAd}
            </Link>
          </div>
        ) : (
          <div className="campaigns-grid">
            {campaigns.slice(0, 6).map((camp) => (
              <CampaignCard key={camp.id} campaign={camp} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
