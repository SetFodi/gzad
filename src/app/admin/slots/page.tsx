'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Megaphone, RefreshCw } from 'lucide-react'
import ProgressRing from '@/components/app/ProgressRing'
import StatusBadge from '@/components/app/StatusBadge'

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

function formatRelative(iso: string | null): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 'never'
  const diff = Date.now() - then
  if (diff < 0) return 'now'
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

/** One slot of a screen's loop, sized by how long it plays. */
function LoopSlot({ slot }: { slot: SlotEntry }) {
  const label = slot.type === 'customer' ? (slot.campaignName ?? 'Unnamed') : slot.type === 'house' ? 'Gzad house ad' : 'Empty'
  return (
    <div className="loop-slot" data-type={slot.type} style={{ flexGrow: Math.max(slot.durationSeconds, 1) }} title={`Slot ${slot.index + 1}: ${label}, ${slot.durationSeconds}s`}>
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
        setError(json.error || `Failed to load (${res.status})`)
        setData(null)
      } else {
        setData(json)
        setError(json.realtimeError ? `Can't reach the Realtime Server (${json.realtimeError}), so online status may be out of date.` : '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

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
    return <div className="portal-loading">Loading slot view…</div>
  }

  if (!data && error) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>Could not load slot data from the database. Please try again.</p>
        <button type="button" className="portal-btn-primary" onClick={() => void loadSlots()}>Try again</button>
      </div>
    </div>
  )

  const perDevice = data?.slotsPerDevice ?? 5
  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'online', label: 'Online' },
    { key: 'offline', label: 'Offline' },
    { key: 'partial', label: 'Partly sold' },
    { key: 'full', label: 'Sold out' },
    { key: 'issues', label: 'Issues' },
  ]

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">Slots</h1>
          <p className="portal-subtitle">
            Every screen plays a loop of {perDevice} slots. Paid slots show the client&apos;s ad; the rest fill with Gzad house ads. Refreshes every 10 seconds.
          </p>
        </div>
        <button type="button" onClick={loadSlots} className="portal-btn-secondary">
          <RefreshCw size={16} aria-hidden /> Refresh
        </button>
      </div>

      {error && <div className="portal-alert portal-alert-warning">{error}</div>}

      {data && (
        <div className="stats-grid">
          <div className="stat-card ring-card">
            <ProgressRing value={data.summary.totalCustomerSlots} max={data.summary.totalSlots} />
            <div className="stat-card-info">
              <span className="stat-card-value">{data.summary.totalCustomerSlots}<span className="stat-card-of"> of {data.summary.totalSlots}</span></span>
              <span className="stat-card-label">Paid slots sold</span>
            </div>
          </div>
          <div className="stat-card ring-card">
            <ProgressRing value={data.summary.totalOnline} max={data.summary.totalDevices} tone="#34c759" />
            <div className="stat-card-info">
              <span className="stat-card-value">{data.realtimeError ? '—' : data.summary.totalOnline}<span className="stat-card-of"> of {data.summary.totalDevices}</span></span>
              <span className="stat-card-label">Screens online</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ color: 'var(--portal-muted)' }}>
              <Megaphone size={24} />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-value">{data.summary.totalHouseSlots}</span>
              <span className="stat-card-label">Filled with house ads</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ color: data.summary.totalConfigIssues ? 'var(--portal-danger)' : 'var(--portal-success)' }}>
              <AlertTriangle size={24} />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-value">{data.summary.totalConfigIssues}</span>
              <span className="stat-card-label">Setup issues</span>
            </div>
          </div>
        </div>
      )}

      <div className="table-toolbar" style={{ marginTop: 28 }}>
        <div className="segmented" role="group" aria-label="Filter screens">
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
            aria-label="Group"
            style={{ width: 'auto', minHeight: 36 }}
          >
            <option value="all">All groups</option>
            <option value="__none__">No group</option>
            {data?.groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <span className="cell-sub">{filteredDevices.length} of {data?.devices.length ?? 0} screens</span>
        </div>
      </div>

      {filteredDevices.length === 0 ? (
        <div className="portal-empty portal-empty-sm"><p>No screens match these filters.</p></div>
      ) : (
        <div className="loop-list">
          {filteredDevices.map(d => (
            <article key={d.cardId} className="loop-row">
              <div className="loop-row-head">
                <span className="device-presence" data-online={d.online || undefined} aria-hidden />
                <div className="cell-stack" style={{ flex: 1 }}>
                  <Link href="/admin/devices" className="table-link">{d.name || d.cardId}</Link>
                  <span className="cell-sub">
                    {d.groupName ?? (d.configIssue === 'no_group' ? <span style={{ color: 'var(--portal-danger)' }}>No group</span> : '—')}
                    {' · '}seen {formatRelative(d.lastSeen)}
                  </span>
                </div>
                <span className="cell-sub cell-nowrap">{d.customerSlotCount} of {perDevice} sold · {d.cycleSeconds}s loop</span>
                <StatusBadge status={data?.realtimeError ? 'unknown' : d.online ? 'online' : 'offline'}>{data?.realtimeError ? 'Unknown' : d.online ? 'Online' : 'Offline'}</StatusBadge>
              </div>
              <div className="loop-strip">
                {d.slots.map(slot => <LoopSlot key={slot.index} slot={slot} />)}
              </div>
              {d.configIssue === 'no_campaigns' && (
                <p className="cell-sub" style={{ margin: 0, color: 'var(--portal-warning)' }}>No active campaigns in this screen&apos;s group, so it only plays house ads.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
