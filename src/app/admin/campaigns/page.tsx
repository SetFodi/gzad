'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface CampaignWithClient {
  id: string
  name: string
  status: string
  start_date: string
  end_date: string
  daily_hours: number
  taxi_count: number
  monthly_price: number
  created_at: string
  clients: { company_name: string } | null
  media_count?: number
  pending_media?: number
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignWithClient[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  async function loadCampaigns() {
    let query = supabase
      .from('campaigns')
      .select('*, clients(company_name)')
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query

    if (data) {
      const withMedia = await Promise.all(
        data.map(async (c) => {
          const { count: mediaCount } = await supabase
            .from('ad_media')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', c.id)

          const { count: pendingMedia } = await supabase
            .from('ad_media')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', c.id)
            .eq('status', 'pending_review')

          return { ...c, media_count: mediaCount || 0, pending_media: pendingMedia || 0 }
        })
      )
      setCampaigns(withMedia)
    }
    setLoading(false)
  }

  useEffect(() => { loadCampaigns() }, [filter])

  const updateStatus = async (campaignId: string, newStatus: string) => {
    await supabase.from('campaigns').update({ status: newStatus }).eq('id', campaignId)
    await loadCampaigns()
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return '#CCF381'
      case 'pending_review': return '#FBBF24'
      case 'paused': return '#94A3B8'
      case 'completed': return '#60A5FA'
      default: return '#64748B'
    }
  }

  if (loading) return <div className="portal-loading">Loading...</div>

  return (
    <div className="portal-page">
      <h1 className="portal-page-title">Manage Campaigns</h1>

      <div className="admin-filters">
        {['all', 'pending_review', 'active', 'paused', 'completed'].map((f) => (
          <button
            key={f}
            className={`admin-filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {campaigns.length === 0 ? (
        <div className="portal-empty"><p>No campaigns found.</p></div>
      ) : (
        <div className="campaigns-table-wrapper">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Client</th>
                <th>Status</th>
                <th>Media</th>
                <th>Period</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/campaigns/${c.id}`} className="table-link">{c.name}</Link>
                  </td>
                  <td>{c.clients?.company_name || '—'}</td>
                  <td>
                    <span className="status-badge" style={{ color: statusColor(c.status), borderColor: statusColor(c.status) }}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    {c.media_count} file{c.media_count !== 1 ? 's' : ''}
                    {c.pending_media! > 0 && (
                      <span className="badge-warning"> ({c.pending_media} pending)</span>
                    )}
                  </td>
                  <td>{c.start_date || '—'} → {c.end_date || '—'}</td>
                  <td>{c.monthly_price ? `${c.monthly_price} GEL/mo` : '—'}</td>
                  <td>
                    <div className="admin-actions">
                      {c.status === 'pending_review' && (
                        <>
                          <button className="action-btn approve" onClick={() => updateStatus(c.id, 'active')}>Approve</button>
                          <button className="action-btn reject" onClick={() => updateStatus(c.id, 'paused')}>Reject</button>
                        </>
                      )}
                      {c.status === 'active' && (
                        <button className="action-btn pause" onClick={() => updateStatus(c.id, 'paused')}>Pause</button>
                      )}
                      {c.status === 'paused' && (
                        <button className="action-btn approve" onClick={() => updateStatus(c.id, 'active')}>Resume</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
