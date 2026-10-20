'use client'

import Link from 'next/link'
import { useTranslations } from '@/lib/i18n'
import StatusBadge, { useStatusLabel } from '@/components/app/StatusBadge'

export interface CampaignSummary {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
  monthly_price?: number | null
  media_count: number
  first_media_url?: string
  first_media_type?: string
}

/** "12 Oct – 30 Nov 2026" from two YYYY-MM-DD dates, either of which may be missing. */
export function formatDateRange(start: string | null, end: string | null, lang: string) {
  const locale = lang === 'ge' ? 'ka-GE' : 'en-GB'
  const fmt = (d: string, withYear: boolean) =>
    new Date(`${d}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
  if (start && end) return `${fmt(start, false)} – ${fmt(end, true)}`
  if (start) return `${fmt(start, true)} →`
  if (end) return `→ ${fmt(end, true)}`
  return '—'
}

/** Groups ad_media rows (oldest first) into a count and first file per campaign. */
export function summariseMedia(rows: { campaign_id: string; file_url: string; file_type: string | null }[]) {
  const byCampaign = new Map<string, { count: number; url?: string; type?: string }>()
  for (const row of rows) {
    const entry = byCampaign.get(row.campaign_id) ?? { count: 0 }
    if (entry.count === 0) {
      entry.url = row.file_url
      entry.type = row.file_type ?? undefined
    }
    entry.count++
    byCampaign.set(row.campaign_id, entry)
  }
  return byCampaign
}

export default function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const { t, lang } = useTranslations()
  const statusLabel = useStatusLabel()
  const p = t.portal.campaigns

  return (
    <Link href={`/portal/dashboard/campaigns/${campaign.id}`} className="campaign-card">
      <div className={`campaign-thumb${campaign.first_media_url ? '' : ' campaign-thumb-empty'}`}>
        {campaign.first_media_url ? (
          campaign.first_media_type?.startsWith('video') ? (
            <video src={campaign.first_media_url} muted playsInline preload="metadata" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={campaign.first_media_url} alt="" loading="lazy" />
          )
        ) : (
          <span>{p.noMedia}</span>
        )}
      </div>
      <div className="campaign-card-header">
        <h3>{campaign.name}</h3>
        <StatusBadge status={campaign.status}>{statusLabel(campaign.status)}</StatusBadge>
      </div>
      <div className="campaign-card-details">
        <div>
          <span className="detail-label">{p.duration}</span>
          <span>{formatDateRange(campaign.start_date, campaign.end_date, lang)}</span>
        </div>
        <div>
          <span className="detail-label">{p.mediaFiles}</span>
          <span>{campaign.media_count}</span>
        </div>
        {!!campaign.monthly_price && campaign.monthly_price > 0 && (
          <div>
            <span className="detail-label">{p.price}</span>
            <span>₾{campaign.monthly_price} / {p.month}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
