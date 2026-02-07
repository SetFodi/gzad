'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  created_at: string
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (!client) { setLoading(false); return }

      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })

      setCampaigns(data || [])
      setLoading(false)
    }
    load()
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

  if (loading) return <div className="portal-loading">Loading...</div>

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <h1 className="portal-page-title">Campaigns</h1>
        <Link href="/portal/dashboard/submit" className="portal-btn-primary">New Campaign</Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="portal-empty">
          <p>No campaigns yet.</p>
          <Link href="/portal/dashboard/submit" className="portal-btn-primary">Create your first campaign</Link>
        </div>
      ) : (
        <div className="campaigns-grid">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/portal/dashboard/campaigns/${c.id}`} className="campaign-card">
              <div className="campaign-card-header">
                <h3>{c.name}</h3>
                <span className="status-badge" style={{ color: statusColor(c.status), borderColor: statusColor(c.status) }}>
                  {c.status.replace('_', ' ')}
                </span>
              </div>
              <div className="campaign-card-details">
                <div><span className="detail-label">Duration</span><span>{c.start_date || '—'} → {c.end_date || '—'}</span></div>
                <div><span className="detail-label">Daily Hours</span><span>{c.daily_hours}h</span></div>
                <div><span className="detail-label">Taxis</span><span>{c.taxi_count}</span></div>
                <div><span className="detail-label">Price</span><span>{c.monthly_price ? `${c.monthly_price} GEL/mo` : '—'}</span></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
