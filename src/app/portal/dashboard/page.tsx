'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Megaphone, Play, Eye, TrendingUp } from 'lucide-react'

interface Stats {
  activeCampaigns: number
  totalPlays: number
  totalImpressions: number
  totalSpent: number
}

interface Campaign {
  id: string
  name: string
  status: string
  start_date: string
  end_date: string
  monthly_price: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ activeCampaigns: 0, totalPlays: 0, totalImpressions: 0, totalSpent: 0 })
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get client profile
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (!client) { setLoading(false); return }

      // Get campaigns
      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })

      const activeCampaigns = campaignsData?.filter(c => c.status === 'active') || []

      // Get play stats
      const campaignIds = campaignsData?.map(c => c.id) || []
      let totalPlays = 0
      let totalSpent = 0

      if (campaignIds.length > 0) {
        const { data: statsData } = await supabase
          .from('play_stats')
          .select('play_count')
          .in('campaign_id', campaignIds)

        totalPlays = statsData?.reduce((sum, s) => sum + s.play_count, 0) || 0
        totalSpent = campaignsData?.reduce((sum, c) => sum + (c.monthly_price || 0), 0) || 0
      }

      setStats({
        activeCampaigns: activeCampaigns.length,
        totalPlays,
        totalImpressions: totalPlays * 45,
        totalSpent,
      })
      setCampaigns(campaignsData || [])
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

  if (loading) {
    return <div className="portal-loading">Loading...</div>
  }

  return (
    <div className="portal-page">
      <h1 className="portal-page-title">Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(204,243,129,0.1)' }}>
            <Megaphone size={24} color="#CCF381" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{stats.activeCampaigns}</span>
            <span className="stat-card-label">Active Campaigns</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(96,165,250,0.1)' }}>
            <Play size={24} color="#60A5FA" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{stats.totalPlays.toLocaleString()}</span>
            <span className="stat-card-label">Total Plays</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(251,191,36,0.1)' }}>
            <Eye size={24} color="#FBBF24" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{stats.totalImpressions.toLocaleString()}</span>
            <span className="stat-card-label">Est. Impressions</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(163,230,53,0.1)' }}>
            <TrendingUp size={24} color="#A3E635" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{stats.totalSpent.toLocaleString()} GEL</span>
            <span className="stat-card-label">Total Spent</span>
          </div>
        </div>
      </div>

      <div className="portal-section">
        <h2>Recent Campaigns</h2>
        {campaigns.length === 0 ? (
          <div className="portal-empty">
            <p>No campaigns yet. Submit your first ad to get started.</p>
            <a href="/portal/dashboard/submit" className="portal-btn-primary">Submit Ad</a>
          </div>
        ) : (
          <div className="campaigns-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <a href={`/portal/dashboard/campaigns/${campaign.id}`} className="campaign-link">
                        {campaign.name}
                      </a>
                    </td>
                    <td>
                      <span className="status-badge" style={{ color: statusColor(campaign.status), borderColor: statusColor(campaign.status) }}>
                        {campaign.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{campaign.start_date || '—'}</td>
                    <td>{campaign.end_date || '—'}</td>
                    <td>{campaign.monthly_price ? `${campaign.monthly_price} GEL/mo` : '—'}</td>
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
