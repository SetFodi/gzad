'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Megaphone, RefreshCw } from 'lucide-react'
import ProgressRing from '@/components/app/ProgressRing'
import StatusBadge from '@/components/app/StatusBadge'
import { useAdminText } from '@/lib/admin-i18n'

interface SlotEntry {
  index: number
  type: 'customer' | 'house' | 'empty'
  campaignId?: string
  campaignName?: string
  mediaUrl?: string
  mediaType?: string
  durationSeconds: number
}

interface DeviceWithSlots {
  cardId: string
  name: string | null
  groupId: string | null
  groupName: string | null
  online: boolean
  lastSeen: string | null
  registered: boolean
  slots: SlotEntry[]
  cycleSeconds: number
  customerSlotCount: number
  houseSlotCount: number
  configIssue: 'no_group' | 'no_campaigns' | null
}

interface GroupSummary {
  id: string
  name: string
}

interface ApiResponse {
  devices: DeviceWithSlots[]
  groups: GroupSummary[]
  summary: {
    totalDevices: number
    totalOnline: number
    totalCustomerSlots: number
    totalHouseSlots: number
    totalConfigIssues: number
    totalSlots: number
  }
  slotsPerDevice: number
  realtimeError?: string
  error?: string
}

type StatusFilter = 'all' | 'online' | 'offline' | 'partial' | 'full' | 'issues'

function formatRelative(iso: string | null, t: (en: string, vars?: Record<string, number>) => string): string {
  if (!iso) return t('never')
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return t('never')
  const diff = Date.now() - then
  if (diff < 0) return t('now')
  const s = Math.floor(diff / 1000)
  if (s < 60) return t('{n} s ago', { n: s })
  const m = Math.floor(s / 60)
  if (m < 60) return t('{n} min ago', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('{n} h ago', { n: h })
  const d = Math.floor(h / 24)
  return t('{n} days ago', { n: d })
}

/** One slot of a screen's loop, sized by how long it plays. */
function LoopSlot({ slot }: { slot: SlotEntry }) {
  const { t } = useAdminText()
  const label = slot.type === 'customer' ? (slot.campaignName ?? t('Unnamed')) : slot.type === 'house' ? t('Gzad house ad') : t('Empty')
  return (
    <div className="loop-slot" data-type={slot.type} style={{ flexGrow: Math.max(slot.durationSeconds, 1) }} title={`${t('Slot {n}', { n: slot.index + 1 })}: ${label}, ${slot.durationSeconds}s`}>
      <div className="loop-slot-media">
        {slot.type === 'customer' && slot.mediaUrl ? (
          slot.mediaType === 'video'
            ? <video src={slot.mediaUrl} muted playsInline preload="metadata" />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={slot.mediaUrl} alt="" loading="lazy" />
        ) : slot.type === 'house' ? (
          <span className="loop-slot-house"><span className="app-brand-mark" aria-hidden /> gzad</span>
        ) : slot.type === 'empty' ? (
          <AlertTriangle size={14} aria-hidden />
        ) : null}
      </div>
      <div className="loop-slot-meta">
        <span className="loop-slot-name">{label}</span>
        <span className="loop-slot-dur">{slot.durationSeconds}s</span>
      </div>
    </div>
  )
}

export default function SlotsPage() {
  const { t } = useAdminText()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const loadSlots = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/slots', { cache: 'no-store' })
      const json: ApiResponse = await res.json()
      if (!res.ok) {
        setError(json.error || t('Failed to load ({status})', { status: res.status }))
        setData(null)
      } else {
        setData(json)
        setError(json.realtimeError ? t('Can’t reach the Realtime Server ({error}), so online status may be out of date.', { error: json.realtimeError }) : '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to load'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadSlots()
    const interval = setInterval(loadSlots, 10000)
    return () => clearInterval(interval)
  }, [loadSlots])

  const filteredDevices = useMemo(() => {
    if (!data) return []
    return data.devices.filter(d => {
      if (groupFilter !== 'all') {
        if (groupFilter === '__none__' && d.groupId) return false
        if (groupFilter !== '__none__' && d.groupId !== groupFilter) return false
      }
      switch (statusFilter) {
        case 'online': return d.online
        case 'offline': return !d.online
        case 'partial': return d.customerSlotCount > 0 && d.customerSlotCount < (data.slotsPerDevice ?? 5)
        case 'full': return d.customerSlotCount >= (data.slotsPerDevice ?? 5)
        case 'issues': return !!d.configIssue
        default: return true
      }
    })
  }, [data, groupFilter, statusFilter])

  if (loading) {
    return <div className="portal-loading">{t('Loading slot view…')}</div>
  }

  if (!data && error) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>{t('Could not load slot data from the database. Please try again.')}</p>
        <button type="button" className="portal-btn-primary" onClick={() => void loadSlots()}>{t('Try again')}</button>
      </div>
    </div>
  )

  const perDevice = data?.slotsPerDevice ?? 5
  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('All') },
    { key: 'online', label: t('Online') },
    { key: 'offline', label: t('Offline') },
    { key: 'partial', label: t('Partly sold') },
    { key: 'full', label: t('Sold out') },
    { key: 'issues', label: t('Issues') },
  ]

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{t('Slots')}</h1>
          <p className="portal-subtitle">
            {t('Every screen plays a loop of {n} slots. Paid slots show the client’s ad; the rest fill with Gzad house ads. Refreshes every 10 seconds.', { n: perDevice })}
          </p>
        </div>
        <button type="button" onClick={loadSlots} className="portal-btn-secondary">
          <RefreshCw size={16} aria-hidden /> {t('Refresh')}
        </button>
      </div>

      {error && <div className="portal-alert portal-alert-warning">{error}</div>}

      {data && (
        <div className="stats-grid">
          <div className="stat-card ring-card">
            <ProgressRing value={data.summary.totalCustomerSlots} max={data.summary.totalSlots} />
            <div className="stat-card-info">
              <span className="stat-card-value">{data.summary.totalCustomerSlots}<span className="stat-card-of"> {t('of {n}', { n: data.summary.totalSlots })}</span></span>
              <span className="stat-card-label">{t('Paid slots sold')}</span>
            </div>
          </div>
          <div className="stat-card ring-card">
            <ProgressRing value={data.summary.totalOnline} max={data.summary.totalDevices} tone="#34c759" />
            <div className="stat-card-info">
              <span className="stat-card-value">{data.realtimeError ? '—' : data.summary.totalOnline}<span className="stat-card-of"> {t('of {n}', { n: data.summary.totalDevices })}</span></span>
              <span className="stat-card-label">{t('Screens online')}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ color: 'var(--portal-muted)' }}>
              <Megaphone size={24} />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-value">{data.summary.totalHouseSlots}</span>
              <span className="stat-card-label">{t('Filled with house ads')}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ color: data.summary.totalConfigIssues ? 'var(--portal-danger)' : 'var(--portal-success)' }}>
              <AlertTriangle size={24} />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-value">{data.summary.totalConfigIssues}</span>
              <span className="stat-card-label">{t('Setup issues')}</span>
            </div>
          </div>
        </div>
      )}

      <div className="table-toolbar" style={{ marginTop: 28 }}>
        <div className="segmented" role="group" aria-label={t('Filter screens')}>
          {filters.map(opt => (
            <button key={opt.key} type="button" aria-pressed={statusFilter === opt.key} onClick={() => setStatusFilter(opt.key)}>
              {opt.label}
            </button>
          ))}
        </div>
        <div className="admin-header-actions">
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            aria-label={t('Group')}
            style={{ width: 'auto', minHeight: 36 }}
          >
            <option value="all">{t('All groups')}</option>
            <option value="__none__">{t('No group')}</option>
            {data?.groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <span className="cell-sub">{t('{shown} of {total} screens', { shown: filteredDevices.length, total: data?.devices.length ?? 0 })}</span>
        </div>
      </div>

      {filteredDevices.length === 0 ? (
        <div className="portal-empty portal-empty-sm"><p>{t('No screens match these filters.')}</p></div>
      ) : (
        <div className="loop-list">
          {filteredDevices.map(d => (
            <article key={d.cardId} className="loop-row">
              <div className="loop-row-head">
                <span className="device-presence" data-online={d.online || undefined} aria-hidden />
                <div className="cell-stack" style={{ flex: 1 }}>
                  <Link href="/admin/devices" className="table-link">{d.name || d.cardId}</Link>
                  <span className="cell-sub">
                    {d.groupName ?? (d.configIssue === 'no_group' ? <span style={{ color: 'var(--portal-danger)' }}>{t('No group')}</span> : '—')}
                    {' · '}{t('seen {ago}', { ago: formatRelative(d.lastSeen, t) })}
                  </span>
                </div>
                <span className="cell-sub cell-nowrap">{t('{sold} of {total} sold', { sold: d.customerSlotCount, total: perDevice })} · {t('{n}s loop', { n: d.cycleSeconds })}</span>
                <StatusBadge status={data?.realtimeError ? 'unknown' : d.online ? 'online' : 'offline'}>{data?.realtimeError ? t('Unknown') : d.online ? t('Online') : t('Offline')}</StatusBadge>
              </div>
              <div className="loop-strip">
                {d.slots.map(slot => <LoopSlot key={slot.index} slot={slot} />)}
              </div>
              {d.configIssue === 'no_campaigns' && (
                <p className="cell-sub" style={{ margin: 0, color: 'var(--portal-warning)' }}>{t('No active campaigns in this screen’s group, so it only plays house ads.')}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
