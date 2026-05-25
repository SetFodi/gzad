'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutGrid,
  Image as ImageIcon,
  Film,
  AlertTriangle,
  Megaphone,
  Wifi,
  WifiOff,
} from 'lucide-react'

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

function SlotCell({ slot }: { slot: SlotEntry }) {
  const isCustomer = slot.type === 'customer'
  const isHouse = slot.type === 'house'

  const baseStyle: React.CSSProperties = {
    border: '1px solid var(--portal-primary-soft)',
    background: isCustomer
      ? 'rgba(241, 226, 209, 0.5)'
      : isHouse
        ? 'rgba(167, 98, 23, 0.08)'
        : 'rgba(163, 58, 58, 0.05)',
    borderColor: isCustomer
      ? 'var(--portal-primary)'
      : isHouse
        ? 'var(--portal-warning)'
        : 'var(--portal-danger)',
    borderRadius: 8,
    padding: '8px 10px',
    minWidth: 130,
    maxWidth: 170,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    overflow: 'hidden',
  }

  const labelColor = isCustomer
    ? 'var(--portal-primary)'
    : isHouse
      ? 'var(--portal-warning)'
      : 'var(--portal-danger)'

  return (
    <div style={baseStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: labelColor, textTransform: 'uppercase' }}>
          {isCustomer ? 'Customer' : isHouse ? 'House' : 'Empty'}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
          padding: '2px 6px', borderRadius: 4,
          background: 'rgba(84, 26, 26, 0.08)', color: 'var(--portal-primary-deep)',
        }}>
          {slot.durationSeconds}s
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isCustomer ? (
          slot.mediaType === 'video'
            ? <Film size={13} style={{ color: 'var(--portal-primary)', flexShrink: 0 }} />
            : <ImageIcon size={13} style={{ color: 'var(--portal-primary)', flexShrink: 0 }} />
        ) : isHouse ? (
          <Megaphone size={13} style={{ color: 'var(--portal-warning)', flexShrink: 0 }} />
        ) : (
          <AlertTriangle size={13} style={{ color: 'var(--portal-danger)', flexShrink: 0 }} />
        )}
        <span style={{
          fontSize: 13, fontWeight: 500,
          color: 'var(--portal-primary-deep)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }} title={slot.campaignName || (isHouse ? 'Gzad house ad' : 'Unassigned')}>
          {isCustomer ? (slot.campaignName ?? 'Unnamed') : isHouse ? 'Gzad house ad' : 'Unassigned'}
        </span>
      </div>
    </div>
  )
}

export default function SlotsPage() {
  const router = useRouter()
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
        setError(json.realtimeError ? `Live status: ${json.realtimeError}` : '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
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

  return (
    <div className="portal-page">
      <div className="portal-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="portal-page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <LayoutGrid size={22} style={{ color: 'var(--portal-primary)' }} />
            Slot Tracker
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--portal-muted)', fontSize: 13 }}>
            {data?.slotsPerDevice ?? 5} slots per LED · auto-refreshing every 10s
          </p>
        </div>
        <button
          onClick={loadSlots}
          className="portal-btn-secondary"
          aria-label="Refresh now"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{
          margin: '12px 0',
          padding: '10px 14px',
          background: 'var(--portal-warning-soft)',
          border: '1px solid var(--portal-warning)',
          borderRadius: 8,
          color: 'var(--portal-warning)',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* KPI Tiles */}
      {data && (
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ color: 'var(--portal-success)' }}>
              <Wifi size={24} />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-value">{data.summary.totalOnline} / {data.summary.totalDevices}</span>
              <span className="stat-card-label">Devices Online</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ color: 'var(--portal-primary)' }}>
              <Megaphone size={24} />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-value">{data.summary.totalCustomerSlots} / {data.summary.totalSlots}</span>
              <span className="stat-card-label">Customer Slots Filled</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ color: 'var(--portal-warning)' }}>
              <LayoutGrid size={24} />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-value">{data.summary.totalHouseSlots}</span>
              <span className="stat-card-label">House Fill Slots</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon" style={{ color: 'var(--portal-danger)' }}>
              <AlertTriangle size={24} />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-value">{data.summary.totalConfigIssues}</span>
              <span className="stat-card-label">Config Issues</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--portal-muted)' }}>
          Group
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              border: '1px solid var(--portal-primary-soft)',
              borderRadius: 6,
              background: 'white',
              color: 'var(--portal-primary-deep)',
              fontSize: 13,
            }}
          >
            <option value="all">All groups</option>
            <option value="__none__">No group assigned</option>
            {data?.groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>

        <div style={{ display: 'inline-flex', gap: 0, border: '1px solid var(--portal-primary-soft)', borderRadius: 6, overflow: 'hidden' }}>
          {([
            { key: 'all', label: 'All' },
            { key: 'online', label: 'Online' },
            { key: 'offline', label: 'Offline' },
            { key: 'partial', label: 'Partial' },
            { key: 'full', label: 'Full' },
            { key: 'issues', label: 'Issues' },
          ] as { key: StatusFilter; label: string }[]).map(opt => {
            const active = statusFilter === opt.key
            return (
              <button
                key={opt.key}
                onClick={() => setStatusFilter(opt.key)}
                style={{
                  padding: '6px 14px',
                  background: active ? 'var(--portal-primary)' : 'transparent',
                  color: active ? '#F1E2D1' : 'var(--portal-primary-deep)',
                  border: 'none',
                  borderLeft: '1px solid var(--portal-primary-soft)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        <span style={{ fontSize: 13, color: 'var(--portal-muted)' }}>
          Showing {filteredDevices.length} of {data?.devices.length ?? 0} devices
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="portal-table" style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              <th style={{ width: 220 }}>Device</th>
              <th style={{ width: 110 }}>Status</th>
              <th>Slot 1</th>
              <th>Slot 2</th>
              <th>Slot 3</th>
              <th>Slot 4</th>
              <th>Slot 5</th>
              <th style={{ width: 110, textAlign: 'right' }}>Cycle</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--portal-muted)' }}>
                  No devices match these filters.
                </td>
              </tr>
            ) : (
              filteredDevices.map(d => (
                <tr
                  key={d.cardId}
                  onClick={() => router.push(`/admin/devices`)}
                  style={{ cursor: 'pointer' }}
                  title="Open Devices page"
                >
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 500, color: 'var(--portal-primary-deep)' }}>
                        {d.name || d.cardId}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--portal-muted)' }}>
                        {d.groupName ? `${d.groupName}` : (d.configIssue === 'no_group' ? <span style={{ color: 'var(--portal-danger)' }}>No group</span> : '—')}
                        {' · '}{formatRelative(d.lastSeen)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 8px', borderRadius: 4,
                      background: d.online ? 'var(--portal-success-soft)' : 'rgba(84, 26, 26, 0.05)',
                      color: d.online ? 'var(--portal-success)' : 'var(--portal-muted)',
                      fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>
                      {d.online ? <Wifi size={12} /> : <WifiOff size={12} />}
                      {d.online ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  {d.slots.map(s => (
                    <td key={s.index} style={{ padding: 6 }}>
                      <SlotCell slot={s} />
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--portal-primary-deep)' }}>
                    {d.cycleSeconds}s
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
