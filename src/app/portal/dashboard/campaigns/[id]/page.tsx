'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { ArrowLeft, Play, Clock, MapPin, Car } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from '@/lib/i18n'

interface Campaign {
  id: string
  name: string
  status: string
  start_date: string
  end_date: string
  daily_hours: number
  taxi_count: number
  monthly_price: number
}

interface PlayStat {
  date: string
  play_count: number
  total_duration_seconds: number
  unique_taxis: number
  km_covered: number
}

interface Media {
  id: string
  file_url: string
  file_type: string
  file_name: string
  status: string
}

export default function CampaignDetailPage() {
  const params = useParams()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [stats, setStats] = useState<PlayStat[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { t } = useTranslations()
  const p = t.portal.campaignDetail
  const c = t.portal.common

  useEffect(() => {
    async function load() {
      const id = params.id as string

      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single()

      const { data: statsData } = await supabase
        .from('play_stats')
        .select('*')
        .eq('campaign_id', id)
        .order('date', { ascending: false })

      const { data: mediaData } = await supabase
        .from('ad_media')
        .select('*')
        .eq('campaign_id', id)
        .order('uploaded_at', { ascending: false })

      setCampaign(campaignData)
      setStats(statsData || [])
      setMedia(mediaData || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return '#CCF381'
      case 'pending_review': return '#FBBF24'
      case 'paused': return '#94A3B8'
      case 'completed': return '#60A5FA'
      case 'approved': return '#CCF381'
      case 'rejected': return '#EF4444'
      default: return '#64748B'
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'active': return c.active
      case 'pending_review': return c.pendingReview
      case 'paused': return c.paused
      case 'completed': return c.completed
      default: return status.replace('_', ' ')
    }
  }

  if (loading) return <div className="portal-loading">{c.loading}</div>
  if (!campaign) return <div className="portal-loading">{p.notFound}</div>

  const totalPlays = stats.reduce((sum, s) => sum + s.play_count, 0)
  const totalDuration = stats.reduce((sum, s) => sum + s.total_duration_seconds, 0)
  const totalKm = stats.reduce((sum, s) => sum + s.km_covered, 0)
  const avgTaxis = stats.length > 0
    ? Math.round(stats.reduce((sum, s) => sum + s.unique_taxis, 0) / stats.length)
    : 0

  return (
    <div className="portal-page">
      <Link href="/portal/dashboard/campaigns" className="portal-back-link">
        <ArrowLeft size={16} /> {p.backToCampaigns}
      </Link>

      <div className="portal-page-header">
        <h1 className="portal-page-title">{campaign.name}</h1>
        <span className="status-badge lg" style={{
          color: statusColor(campaign.status),
          borderColor: statusColor(campaign.status)
        }}>
          {statusLabel(campaign.status)}
        </span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(204,243,129,0.1)' }}>
            <Play size={24} color="#CCF381" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{totalPlays.toLocaleString()}</span>
            <span className="stat-card-label">{p.totalPlays}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(96,165,250,0.1)' }}>
            <Clock size={24} color="#60A5FA" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{Math.round(totalDuration / 3600)}h</span>
            <span className="stat-card-label">{p.screenTime}</span>
          </div>
        </div>
        {totalKm > 0 && (
          <div className="stat-card">
            <div className="stat-card-icon" style={{ background: 'rgba(251,191,36,0.1)' }}>
              <MapPin size={24} color="#FBBF24" />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-value">{totalKm.toFixed(0)} km</span>
              <span className="stat-card-label">{p.distanceCovered}</span>
            </div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(163,230,53,0.1)' }}>
            <Car size={24} color="#A3E635" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{avgTaxis}</span>
            <span className="stat-card-label">{p.avgTaxisDay}</span>
          </div>
        </div>
      </div>

      {stats.length > 0 && (
        <div className="portal-section">
          <h2>{p.dailyPlayLog}</h2>
          <div className="campaigns-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>{p.date}</th>
                  <th>{p.plays}</th>
                  <th>{p.duration}</th>
                  <th>{p.taxisCol}</th>
                  {totalKm > 0 && <th>{p.km}</th>}
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={i}>
                    <td>{s.date}</td>
                    <td>{s.play_count}</td>
                    <td>{Math.round(s.total_duration_seconds / 60)} min</td>
                    <td>{s.unique_taxis}</td>
                    {totalKm > 0 && <td>{s.km_covered} km</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {media.length > 0 && (
        <div className="portal-section">
          <h2>{p.adMedia}</h2>
          <div className="media-grid">
            {media.map((m) => (
              <div key={m.id} className="media-card">
                {m.file_type.startsWith('image') ? (
                  <img src={m.file_url} alt={m.file_name} />
                ) : (
                  <video src={m.file_url} controls />
                )}
                <div className="media-card-info">
                  <span>{m.file_name}</span>
                  <span className="status-badge sm" style={{
                    color: statusColor(m.status),
                    borderColor: statusColor(m.status),
                  }}>
                    {m.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
