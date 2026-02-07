'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { ArrowLeft, Play, Clock, MapPin, Car } from 'lucide-react'
import Link from 'next/link'

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

  if (loading) return <div className="portal-loading">Loading...</div>
  if (!campaign) return <div className="portal-loading">Campaign not found</div>

  const totalPlays = stats.reduce((sum, s) => sum + s.play_count, 0)
  const totalDuration = stats.reduce((sum, s) => sum + s.total_duration_seconds, 0)
  const totalKm = stats.reduce((sum, s) => sum + s.km_covered, 0)
  const avgTaxis = stats.length > 0
    ? Math.round(stats.reduce((sum, s) => sum + s.unique_taxis, 0) / stats.length)
    : 0

  return (
    <div className="portal-page">
      <Link href="/portal/dashboard/campaigns" className="portal-back-link">
        <ArrowLeft size={16} /> Back to Campaigns
      </Link>

      <div className="portal-page-header">
        <h1 className="portal-page-title">{campaign.name}</h1>
        <span className="status-badge lg" style={{
          color: campaign.status === 'active' ? '#CCF381' : '#FBBF24',
          borderColor: campaign.status === 'active' ? '#CCF381' : '#FBBF24'
        }}>
          {campaign.status.replace('_', ' ')}
        </span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(204,243,129,0.1)' }}>
            <Play size={24} color="#CCF381" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{totalPlays.toLocaleString()}</span>
            <span className="stat-card-label">Total Plays</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(96,165,250,0.1)' }}>
            <Clock size={24} color="#60A5FA" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{Math.round(totalDuration / 3600)}h</span>
            <span className="stat-card-label">Screen Time</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(251,191,36,0.1)' }}>
            <MapPin size={24} color="#FBBF24" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{totalKm.toFixed(0)} km</span>
            <span className="stat-card-label">Distance Covered</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(163,230,53,0.1)' }}>
            <Car size={24} color="#A3E635" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{avgTaxis}</span>
            <span className="stat-card-label">Avg. Taxis/Day</span>
          </div>
        </div>
      </div>

      {/* Play Stats Table */}
      {stats.length > 0 && (
        <div className="portal-section">
          <h2>Daily Play Log</h2>
          <div className="campaigns-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plays</th>
                  <th>Duration</th>
                  <th>Taxis</th>
                  <th>KM</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={i}>
                    <td>{s.date}</td>
                    <td>{s.play_count}</td>
                    <td>{Math.round(s.total_duration_seconds / 60)} min</td>
                    <td>{s.unique_taxis}</td>
                    <td>{s.km_covered} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Media */}
      {media.length > 0 && (
        <div className="portal-section">
          <h2>Ad Media</h2>
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
                    color: m.status === 'approved' ? '#CCF381' : m.status === 'rejected' ? '#EF4444' : '#FBBF24',
                    borderColor: m.status === 'approved' ? '#CCF381' : m.status === 'rejected' ? '#EF4444' : '#FBBF24',
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
