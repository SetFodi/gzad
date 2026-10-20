'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { readAllRows } from '@/lib/supabase/read'
import { useTranslations } from '@/lib/i18n'
import CampaignCard, { summariseMedia, type CampaignSummary } from '@/components/portal/CampaignCard'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { t } = useTranslations()
  const p = t.portal.campaigns
  const c = t.portal.common

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const supabase = createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw authError ?? new Error('Not authenticated')

        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('id')
          .eq('auth_user_id', user.id)
          .single()

        if (clientError || !client) throw clientError ?? new Error('Client profile unavailable')

        const data = await readAllRows<CampaignSummary>((from, to) => supabase
          .from('campaigns')
          .select('*')
          .eq('client_id', client.id)
          .order('created_at', { ascending: false }).order('id').range(from, to))

        const ids = (data || []).map(camp => camp.id)
        const mediaRows = ids.length
          ? await readAllRows<{ campaign_id: string; file_url: string; file_type: string | null }>((from, to) => supabase
            .from('ad_media')
            .select('campaign_id, file_url, file_type')
            .in('campaign_id', ids)
            .order('uploaded_at', { ascending: true }).order('id').range(from, to))
          : []
        const media = summariseMedia(mediaRows || [])

        if (!active) return
        setCampaigns(data.map(camp => {
          const m = media.get(camp.id)
          return { ...camp, media_count: m?.count ?? 0, first_media_url: m?.url, first_media_type: m?.type }
        }))
      } catch {
        if (active) setLoadError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [attempt])

  if (loading) return <div className="portal-loading">{c.loading}</div>

  if (loadError) return (
    <div className="portal-page">
      <h1 className="portal-page-title">{p.title}</h1>
      <div className="portal-alert portal-alert-error" role="alert">{c.loadError}</div>
      <button type="button" className="portal-btn-primary" onClick={() => { setLoadError(false); setLoading(true); setAttempt(value => value + 1) }}>{c.retry}</button>
    </div>
  )

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{p.title}</h1>
          <p className="portal-subtitle">{p.subtitle}</p>
        </div>
        <Link href="/portal/dashboard/submit" className="portal-btn-primary">
          <Plus size={16} aria-hidden />
          {p.newCampaign}
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="portal-empty">
          <p>{p.noCampaigns}</p>
          <Link href="/portal/dashboard/submit" className="portal-btn-primary">{p.createFirst}</Link>
        </div>
      ) : (
        <div className="campaigns-grid">
          {campaigns.map((camp) => (
            <CampaignCard key={camp.id} campaign={camp} />
          ))}
        </div>
      )}
    </div>
  )
}
