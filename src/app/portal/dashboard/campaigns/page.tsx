'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  created_at: string
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { t } = useTranslations()
  const p = t.portal.campaigns
  const c = t.portal.common

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

  const statusLabel = (status: string) => {
    switch (status) {
      case 'active': return c.active
      case 'pending_review': return c.pendingReview
      case 'paused': return c.paused
      case 'completed': return c.completed
      default: return status
    }
  }

  if (loading) return <div className="portal-loading">{c.loading}</div>

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <h1 className="portal-page-title">{p.title}</h1>
        <Link href="/portal/dashboard/submit" className="portal-btn-primary">{p.newCampaign}</Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="portal-empty">
          <p>{p.noCampaigns}</p>
          <Link href="/portal/dashboard/submit" className="portal-btn-primary">{p.createFirst}</Link>
        </div>
      ) : (
        <div className="campaigns-grid">
          {campaigns.map((camp) => (
            <Link key={camp.id} href={`/portal/dashboard/campaigns/${camp.id}`} className="campaign-card">
              <div className="campaign-card-header">
                <h3>{camp.name}</h3>
                <span className="status-badge" style={{ color: statusColor(camp.status), borderColor: statusColor(camp.status) }}>
                  {statusLabel(camp.status)}
                </span>
              </div>
              <div className="campaign-card-details">
                <div><span className="detail-label">{p.duration}</span><span>{camp.start_date || '—'} → {camp.end_date || '—'}</span></div>
                <div><span className="detail-label">{p.dailyHours}</span><span>{camp.daily_hours}h</span></div>
                <div><span className="detail-label">{p.taxis}</span><span>{camp.taxi_count}</span></div>
                <div><span className="detail-label">{p.price}</span><span>{camp.monthly_price ? `${camp.monthly_price} GEL/mo` : '—'}</span></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
