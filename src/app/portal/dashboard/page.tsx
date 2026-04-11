'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Megaphone, Play, Clock, Plus } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from '@/lib/i18n'

interface CampaignWithMedia {
  id: string
  name: string
  status: string
  start_date: string
  end_date: string
  monthly_price: number
  media_count: number
  first_media_url?: string
  first_media_type?: string
}

function formatScreenTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function DashboardPage() {
  const [activeCampaigns, setActiveCampaigns] = useState(0)
  const [totalPlays, setTotalPlays] = useState(0)
  const [totalScreenTime, setTotalScreenTime] = useState(0)
  const [campaigns, setCampaigns] = useState<CampaignWithMedia[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { t } = useTranslations()
  const p = t.portal.dashboard
  const c = t.portal.common

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (!client) { setLoading(false); return }

      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })

      const active = campaignsData?.filter(c => c.status === 'active') || []
      const campaignIds = campaignsData?.map(c => c.id) || []

      let plays = 0
      let screenTime = 0

      if (campaignIds.length > 0) {
        const { data: statsData } = await supabase
          .from('play_stats')
          .select('play_count, total_duration_seconds')
          .in('campaign_id', campaignIds)

        plays = statsData?.reduce((sum, s) => sum + s.play_count, 0) || 0
        screenTime = statsData?.reduce((sum, s) => sum + (s.total_duration_seconds || 0), 0) || 0

        if (plays === 0) {
          const { data: rawLogs } = await supabase
            .from('play_logs')
            .select('duration_seconds')
            .in('campaign_id', campaignIds)

          plays = rawLogs?.length || 0
          screenTime = rawLogs?.reduce((sum, l) => sum + (l.duration_seconds || 0), 0) || 0
        }
      }

      // Fetch first media for each campaign
      const withMedia = await Promise.all(
        (campaignsData || []).map(async (camp) => {
          const [{ count: mediaCount }, { data: firstMedia }] = await Promise.all([
            supabase.from('ad_media').select('*', { count: 'exact', head: true }).eq('campaign_id', camp.id),
            supabase.from('ad_media').select('file_url, file_type').eq('campaign_id', camp.id).order('uploaded_at', { ascending: true }).limit(1),
          ])
          return {
            ...camp,
            media_count: mediaCount || 0,
            first_media_url: firstMedia?.[0]?.file_url || undefined,
            first_media_type: firstMedia?.[0]?.file_type || undefined,
          }
        })
      )

      setActiveCampaigns(active.length)
      setTotalPlays(plays)
      setTotalScreenTime(screenTime)
      setCampaigns(withMedia)
      setLoading(false)
    }

    loadData()
  }, [])

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return '#CCF381'
      case 'pending_review': return '#FBBF24'
      case 'paused': return '#94A3B8'
      case 'completed': return '#60A5FA'
      default: return '#64748B'
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'active': return c.active
      case 'pending_review': return c.pendingReview
      case 'paused': return c.paused
      case 'completed': return c.completed
      default: return status
    }
  }

  if (loading) {
    return <div className="portal-loading">{c.loading}</div>
  }

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <h1 className="portal-page-title">{p.title}</h1>
        <Link href="/portal/dashboard/submit" className="portal-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} />
          {p.submitAd}
        </Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(204,243,129,0.1)' }}>
            <Megaphone size={24} color="#CCF381" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{activeCampaigns}</span>
            <span className="stat-card-label">{p.activeCampaigns}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(96,165,250,0.1)' }}>
            <Play size={24} color="#60A5FA" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{totalPlays.toLocaleString()}</span>
            <span className="stat-card-label">{p.totalPlays}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(251,191,36,0.1)' }}>
            <Clock size={24} color="#FBBF24" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{formatScreenTime(totalScreenTime)}</span>
            <span className="stat-card-label">{p.screenTime}</span>
          </div>
        </div>
      </div>

      <div className="portal-section">
        <h2>{p.recentCampaigns}</h2>
        {campaigns.length === 0 ? (
          <div className="portal-empty">
            <p>{p.noCampaigns}</p>
            <Link href="/portal/dashboard/submit" className="portal-btn-primary">{p.submitAd}</Link>
          </div>
        ) : (
          <div className="campaigns-grid">
            {campaigns.map((camp) => (
              <Link key={camp.id} href={`/portal/dashboard/campaigns/${camp.id}`} className="campaign-card">
                {camp.first_media_url && (
                  <div style={{
                    marginBottom: 12,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    height: 100,
                    background: '#000',
                  }}>
                    {camp.first_media_type?.startsWith('video') ? (
                      <video
                        src={camp.first_media_url}
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <img
                        src={camp.first_media_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                  </div>
                )}
                <div className="campaign-card-header">
                  <h3>{camp.name}</h3>
                  <span className="status-badge" style={{ color: statusColor(camp.status), borderColor: statusColor(camp.status) }}>
                    {statusLabel(camp.status)}
                  </span>
                </div>
                <div className="campaign-card-details">
                  <div>
                    <span className="detail-label">{c.startDate}</span>
                    <span>{camp.start_date || '—'}</span>
                  </div>
                  <div>
                    <span className="detail-label">{c.endDate}</span>
                    <span>{camp.end_date || '—'}</span>
                  </div>
                  <div>
                    <span className="detail-label">{p.mediaFiles}</span>
                    <span>{camp.media_count} file{camp.media_count !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
