'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { readAllRows } from '@/lib/supabase/read'
import { aggregateCampaignPlays, type CampaignPlayLog, type DailyPlayStatistics } from '@/lib/play-statistics'
import { useParams } from 'next/navigation'
import { ArrowLeft, Play, Clock, MapPin, Car, X, Download } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from '@/lib/i18n'
import StatusBadge, { useStatusLabel } from '@/components/app/StatusBadge'
import { formatDateRange } from '@/components/portal/CampaignCard'
import dynamic from 'next/dynamic'
import type { PlayPoint } from '@/components/portal/CampaignMapView'
import DailyCapControl from '@/components/portal/DailyCapControl'
import { buildReportRows, reportToCsv, tbilisiDayRange, type ReportCharge, type ReportPlayLog } from '@/lib/campaign-report'

const CampaignMapView = dynamic(() => import('@/components/portal/CampaignMapView'), { ssr: false })

interface Campaign {
  id: string
  name: string
  status: string
  start_date: string
  end_date: string
  daily_hours: number
  taxi_count: number
  monthly_price: number
  daily_cap?: number | string | null
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
  const [allDays, setAllDays] = useState<DailyPlayStatistics[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [playPoints, setPlayPoints] = useState<PlayPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reload, setReload] = useState(0)
  const [reportBusy, setReportBusy] = useState(false)
  const [reportError, setReportError] = useState(false)
  const supabase = createClient()
  const { t, lang } = useTranslations()
  const p = t.portal.campaignDetail
  const c = t.portal.common
  const statusLabel = useStatusLabel()
  const mediaStatusLabel = (status: string) =>
    status === 'approved' ? c.approved : status === 'rejected' ? c.rejected : statusLabel(status)

  // Date range selection
  const [selStart, setSelStart] = useState<number | null>(null)
  const [selEnd, setSelEnd] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<number | null>(null)
  const dragMoved = useRef(false)
  const selectionAnchor = useRef<number | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && chartRef.current) chartRef.current.scrollLeft = chartRef.current.scrollWidth
  }, [allDays, loading])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(false)
      try {
        const id = params.id as string

        const { data: campaignData, error: campaignError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', id)
          .single()

        if (campaignError && campaignError.code !== 'PGRST116') throw campaignError
        if (!campaignData) {
          if (!cancelled) setCampaign(null)
          return
        }

        const statsData = await readAllRows<DailyPlayStatistics>((from, to) => supabase
          .from('play_stats')
          .select('*')
          .eq('campaign_id', id)
          .order('date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to))

        // If play_stats is empty, aggregate from raw play_logs
        let dayStats = statsData
        if (dayStats.length === 0) {
          const rawLogs = await readAllRows<CampaignPlayLog>((from, to) => supabase
            .from('play_logs')
            .select('began_at, duration_seconds, device_id')
            .eq('campaign_id', id)
            .order('began_at', { ascending: true })
            .order('id', { ascending: true })
            .range(from, to))
          dayStats = aggregateCampaignPlays(rawLogs)
        }

        // Build full 30-day range with gaps filled
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const dayMap: Record<string, DailyPlayStatistics> = {}
        for (const s of dayStats) {
          dayMap[s.date] = s
        }
        const fullDays: DailyPlayStatistics[] = []
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

        const mediaData = await readAllRows<Media>((from, to) => supabase
          .from('ad_media')
          .select('*')
          .eq('campaign_id', id)
          .order('uploaded_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to))

        // Fetch play log GPS points for map
        const gpsLogs = await readAllRows<{ lat: number; lng: number }>((from, to) => supabase
          .from('play_logs')
          .select('lat, lng')
          .eq('campaign_id', id)
          .not('lat', 'eq', 0)
          .not('lng', 'eq', 0)
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .order('began_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to))

        // Group by rounded coordinates (~11m precision)
        const pointMap: Record<string, PlayPoint> = {}
        for (const log of gpsLogs || []) {
          const key = `${Number(log.lat).toFixed(4)},${Number(log.lng).toFixed(4)}`
          if (!pointMap[key]) {
            pointMap[key] = { lat: Number(log.lat), lng: Number(log.lng), count: 0 }
          }
          pointMap[key].count++
        }
        const points = Object.values(pointMap).sort((a, b) => b.count - a.count)

        if (cancelled) return
        setCampaign(campaignData)
        setAllDays(fullDays)
        setMedia(mediaData || [])
        setPlayPoints(points)
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [params.id, reload, supabase])

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
    dragMoved.current = false
  }
  const handleBarMouseEnter = (index: number) => {
    if (dragging && dragStart.current !== null) {
      dragMoved.current = index !== dragStart.current
      selectionAnchor.current = null
      setSelStart(dragStart.current)
      setSelEnd(index)
    }
  }
  const handleBarMouseUp = () => {
    setDragging(false)
    dragStart.current = null
  }
  const handleBarClick = (index: number, event: React.MouseEvent<HTMLButtonElement>) => {
    if (dragMoved.current && event.detail > 0) return
    if ((event.shiftKey && selStart !== null) || selectionAnchor.current !== null) {
      setSelStart(selectionAnchor.current ?? selStart)
      setSelEnd(index)
      selectionAnchor.current = null
    } else {
      setSelStart(index)
      setSelEnd(index)
      selectionAnchor.current = index
    }
  }
  const clearSelection = () => {
    selectionAnchor.current = null
    dragMoved.current = false
    setSelStart(null)
    setSelEnd(null)
    setDragging(false)
    dragStart.current = null
  }

  // CSV of the selected days (or every day on the chart), per hour and screen.
  const downloadReport = async () => {
    const first = allDays[hasSelection ? selMin : 0]?.date
    const last = allDays[hasSelection ? selMax : allDays.length - 1]?.date
    if (!campaign || !first || !last) return
    setReportBusy(true)
    setReportError(false)
    try {
      const { from, to } = tbilisiDayRange(first, last)
      // RLS limits both tables to the signed-in client's own rows.
      const [plays, charges] = await Promise.all([
        readAllRows<ReportPlayLog>((start, end) => supabase
          .from('play_logs')
          .select('began_at, device_id, duration_seconds')
          .eq('campaign_id', campaign.id)
          .gte('began_at', from)
          .lt('began_at', to)
          .order('began_at', { ascending: true })
          .order('id', { ascending: true })
          .range(start, end)),
        readAllRows<ReportCharge>((start, end) => supabase
          .from('billing_logs')
          .select('period_start, device_id, district, total_cost')
          .eq('campaign_id', campaign.id)
          .gte('period_start', from)
          .lt('period_start', to)
          .order('period_start', { ascending: true })
          .order('id', { ascending: true })
          .range(start, end)),
      ])
      const csv = reportToCsv(buildReportRows(plays, charges), {
        date: p.date,
        hour: p.reportHour,
        screen: p.reportScreen,
        plays: p.plays,
        airtime: p.reportAirtime,
        district: p.reportDistrict,
        cost: p.reportCost,
      })
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `gzad-${campaign.name.trim().replace(/\s+/g, '-')}-${first === last ? first : `${first}_${last}`}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setReportError(true)
    } finally {
      setReportBusy(false)
    }
  }

  if (loading) return <div className="portal-loading">{c.loading}</div>
  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>{c.loadError}</p>
        <button type="button" className="portal-btn-primary" onClick={() => setReload(value => value + 1)}>{c.retry}</button>
      </div>
    </div>
  )
  if (!campaign) return <div className="portal-loading">{p.notFound}</div>

  const totalPlays = filteredDays.reduce((sum, s) => sum + s.play_count, 0)
  const totalDuration = filteredDays.reduce((sum, s) => sum + s.total_duration_seconds, 0)
  const totalKm = filteredDays.reduce((sum, s) => sum + (s.km_covered ?? 0), 0)
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
        <div>
          <h1 className="portal-page-title">{campaign.name}</h1>
          <p className="portal-subtitle">{formatDateRange(campaign.start_date, campaign.end_date, lang)}</p>
        </div>
        <StatusBadge status={campaign.status}>{statusLabel(campaign.status)}</StatusBadge>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-primary)' }}>
            <Play size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{totalPlays.toLocaleString()}</span>
            <span className="stat-card-label">{p.totalPlays}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-info)' }}>
            <Clock size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{formatScreenTime(totalDuration)}</span>
            <span className="stat-card-label">{p.screenTime}</span>
          </div>
        </div>
        {totalKm > 0 && (
          <div className="stat-card">
            <div className="stat-card-icon" style={{ color: 'var(--portal-warning)' }}>
              <MapPin size={24} />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-value">{totalKm.toFixed(0)} km</span>
              <span className="stat-card-label">{p.distanceCovered}</span>
            </div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-card-icon" style={{ color: 'var(--portal-success)' }}>
            <Car size={24} />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{avgTaxis}</span>
            <span className="stat-card-label">{p.avgTaxisDay}</span>
          </div>
        </div>
      </div>

      {campaign.daily_cap !== undefined && (
        <DailyCapControl key={campaign.id} campaignId={campaign.id} dailyCap={campaign.daily_cap} status={campaign.status} />
      )}

      {/* Selectable Daily Chart */}
      <div className="portal-section">
        <div className="section-head">
          <h2>{p.dailyPlayLog}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {hasSelection ? (
              <>
                <span style={{ fontSize: 13, color: 'var(--portal-text-soft)', fontWeight: 500 }}>{selLabel}</span>
                <button type="button" onClick={clearSelection} className="action-btn">
                  <X size={12} aria-hidden /> {p.clearSelection}
                </button>
              </>
            ) : allDays.length > 1 && (
              <span style={{ fontSize: 13, color: 'var(--portal-muted)' }}>{p.dragHint}</span>
            )}
            <button type="button" onClick={() => void downloadReport()} className="action-btn" disabled={reportBusy}>
              <Download size={12} aria-hidden /> {reportBusy ? p.downloadingReport : p.downloadReport}
            </button>
          </div>
        </div>
        {reportError && <div className="portal-alert portal-alert-danger" role="alert">{p.reportError}</div>}
        <div
          className="play-chart"
          ref={chartRef}
          role="group"
          aria-label={p.dailyPlayLog}
          onMouseLeave={() => { if (dragging) handleBarMouseUp() }}
        >
          {allDays.map((d, i) => {
            const isSelected = hasSelection && i >= selMin && i <= selMax
            const isInactive = hasSelection && !isSelected
            return (
              <button
                key={d.date}
                type="button"
                className="play-chart-day"
                aria-label={`${d.date}: ${d.play_count} ${p.plays}, ${formatScreenTime(d.total_duration_seconds)}`}
                aria-pressed={isSelected}
                title={`${d.date}: ${d.play_count} ${p.plays}, ${formatScreenTime(d.total_duration_seconds)}`}
                onMouseDown={() => handleBarMouseDown(i)}
                onMouseEnter={() => handleBarMouseEnter(i)}
                onClick={event => handleBarClick(i, event)}
              >
                <span className="play-chart-bar" style={{
                  height: `${Math.max((d.play_count / maxDailyPlays) * 100, 2)}%`,
                  background: isSelected
                    ? 'var(--portal-primary)'
                    : isInactive
                      ? 'var(--portal-primary-soft)'
                      : d.play_count > 0 ? 'var(--portal-primary)' : 'var(--portal-fill)',
                  opacity: !hasSelection && d.play_count > 0 ? 0.55 : 1,
                }} />
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--portal-muted)', margin: '-6px 4px 4px' }}>
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
                  {totalKm > 0 && <td>{s.km_covered === null ? '—' : `${s.km_covered} km`}</td>}
                </tr>
              ))}
              {filteredDays.filter(s => s.play_count > 0).length === 0 && (
                <tr><td colSpan={totalKm > 0 ? 5 : 4} style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>{p.noPlays}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {playPoints.length > 0 && (
        <div className="portal-section">
          <div>
            <h2>{p.coverageMap}</h2>
            <p className="portal-subtitle" style={{ marginTop: 4 }}>
              {p.coverageSummary
                .replace('{plays}', playPoints.reduce((s, pt) => s + pt.count, 0).toLocaleString())
                .replace('{places}', playPoints.length.toLocaleString())}
            </p>
          </div>
          <div className="map-card">
            <CampaignMapView points={playPoints} />
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
                  <StatusBadge status={m.status}>{mediaStatusLabel(m.status)}</StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
