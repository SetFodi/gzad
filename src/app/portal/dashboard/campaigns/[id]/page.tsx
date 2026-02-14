'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { ArrowLeft, Play, Clock, MapPin, Car, X } from 'lucide-react'
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

interface DayData {
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

const TZ = 'Asia/Tbilisi'
function toTbilisiDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
}

function formatScreenTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function CampaignDetailPage() {
  const params = useParams()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [allDays, setAllDays] = useState<DayData[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { t } = useTranslations()
  const p = t.portal.campaignDetail
  const c = t.portal.common

  // Date range selection
  const [selStart, setSelStart] = useState<number | null>(null)
  const [selEnd, setSelEnd] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<number | null>(null)

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
        .order('date', { ascending: true })

      // If play_stats is empty, aggregate from raw play_logs
      let dayStats = statsData || []
      if (dayStats.length === 0) {
        const { data: rawLogs } = await supabase
          .from('play_logs')
          .select('began_at, duration_seconds')
          .eq('campaign_id', id)

        if (rawLogs && rawLogs.length > 0) {
          const byDate: Record<string, { plays: number; duration: number }> = {}
          for (const log of rawLogs) {
            const date = log.began_at ? toTbilisiDate(log.began_at) : 'unknown'
            if (!byDate[date]) byDate[date] = { plays: 0, duration: 0 }
            byDate[date].plays++
            byDate[date].duration += log.duration_seconds || 0
          }
          dayStats = Object.entries(byDate)
            .map(([date, d]) => ({
              date,
              play_count: d.plays,
              total_duration_seconds: d.duration,
              unique_taxis: 1,
              km_covered: 0,
            }))
            .sort((a, b) => a.date.localeCompare(b.date))
        }
      }

      // Build full 30-day range with gaps filled
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const dayMap: Record<string, DayData> = {}
      for (const s of dayStats) {
        dayMap[s.date] = s
      }
      const fullDays: DayData[] = []
      const d = new Date(thirtyDaysAgo)
      const today = new Date()
      while (d <= today) {
        const dateStr = toTbilisiDate(d.toISOString())
        fullDays.push(dayMap[dateStr] || {
          date: dateStr,
          play_count: 0,
          total_duration_seconds: 0,
          unique_taxis: 0,
          km_covered: 0,
        })
        d.setDate(d.getDate() + 1)
      }

      const { data: mediaData } = await supabase
        .from('ad_media')
        .select('*')
        .eq('campaign_id', id)
        .order('uploaded_at', { ascending: false })

      setCampaign(campaignData)
      setAllDays(fullDays)
      setMedia(mediaData || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  // Selection logic
  const hasSelection = selStart !== null && selEnd !== null
  const selMin = hasSelection ? Math.min(selStart!, selEnd!) : -1
  const selMax = hasSelection ? Math.max(selStart!, selEnd!) : -1

  const filteredDays = hasSelection
    ? allDays.slice(selMin, selMax + 1)
    : allDays

  const selLabel = hasSelection
    ? allDays[selMin]?.date === allDays[selMax]?.date
      ? allDays[selMin]?.date
      : `${allDays[selMin]?.date} — ${allDays[selMax]?.date}`
    : null

  const handleBarMouseDown = (index: number) => {
    dragStart.current = index
    setDragging(true)
    setSelStart(index)
    setSelEnd(index)
  }
  const handleBarMouseEnter = (index: number) => {
    if (dragging && dragStart.current !== null) {
      setSelStart(dragStart.current)
      setSelEnd(index)
    }
  }
  const handleBarMouseUp = () => {
    setDragging(false)
    dragStart.current = null
  }
  const clearSelection = () => {
    setSelStart(null)
    setSelEnd(null)
    setDragging(false)
    dragStart.current = null
  }

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

  const totalPlays = filteredDays.reduce((sum, s) => sum + s.play_count, 0)
  const totalDuration = filteredDays.reduce((sum, s) => sum + s.total_duration_seconds, 0)
  const totalKm = filteredDays.reduce((sum, s) => sum + s.km_covered, 0)
  const daysWithData = filteredDays.filter(s => s.unique_taxis > 0)
  const avgTaxis = daysWithData.length > 0
    ? Math.round(daysWithData.reduce((sum, s) => sum + s.unique_taxis, 0) / daysWithData.length)
    : 0

  const maxDailyPlays = Math.max(...allDays.map(d => d.play_count), 1)

  return (
    <div className="portal-page" onMouseUp={handleBarMouseUp}>
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
            <span className="stat-card-value">{formatScreenTime(totalDuration)}</span>
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

      {/* Selectable Daily Chart */}
      <div className="portal-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{p.dailyPlayLog}</h2>
          {hasSelection && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#CCF381', fontWeight: 500 }}>{selLabel}</span>
              <button onClick={clearSelection} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                borderRadius: 6, fontSize: 12, border: '1px solid rgba(204,243,129,0.3)',
                background: 'rgba(204,243,129,0.08)', color: '#CCF381', cursor: 'pointer',
              }}>
                <X size={12} /> Clear
              </button>
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex', alignItems: 'flex-end', gap: '2px', height: '80px',
            padding: '1rem', background: 'var(--card)', borderRadius: '0.75rem',
            border: '1px solid var(--border)', userSelect: 'none', marginBottom: 4,
          }}
          onMouseLeave={() => { if (dragging) handleBarMouseUp() }}
        >
          {allDays.map((d, i) => {
            const isSelected = hasSelection && i >= selMin && i <= selMax
            const isInactive = hasSelection && !isSelected
            return (
              <div
                key={d.date}
                title={`${d.date}: ${d.play_count} plays, ${formatScreenTime(d.total_duration_seconds)}`}
                onMouseDown={() => handleBarMouseDown(i)}
                onMouseEnter={() => handleBarMouseEnter(i)}
                style={{
                  flex: 1,
                  height: `${Math.max((d.play_count / maxDailyPlays) * 100, 2)}%`,
                  background: isSelected
                    ? '#CCF381'
                    : isInactive
                      ? 'rgba(204,243,129,0.1)'
                      : d.play_count > 0 ? 'rgba(204,243,129,0.5)' : 'rgba(204,243,129,0.12)',
                  borderRadius: '2px 2px 0 0',
                  minWidth: '3px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              />
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#525252', marginBottom: 16 }}>
          <span>{allDays[0]?.date}</span>
          <span>{allDays[allDays.length - 1]?.date}</span>
        </div>

        {/* Daily Table */}
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
              {filteredDays.filter(s => s.play_count > 0).reverse().map((s, i) => (
                <tr key={i}>
                  <td>{s.date}</td>
                  <td>{s.play_count}</td>
                  <td>{Math.round(s.total_duration_seconds / 60)} min</td>
                  <td>{s.unique_taxis}</td>
                  {totalKm > 0 && <td>{s.km_covered} km</td>}
                </tr>
              ))}
              {filteredDays.filter(s => s.play_count > 0).length === 0 && (
                <tr><td colSpan={totalKm > 0 ? 5 : 4} style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>No plays in this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
