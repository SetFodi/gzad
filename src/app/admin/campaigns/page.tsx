'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, X, Trash2 } from 'lucide-react'

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
  device_group_id: string | null
  clients: { company_name: string } | null
  media_count?: number
  pending_media?: number
}

interface ClientOption {
  id: string
  company_name: string
}

const NAME_REGEX = /^[a-z0-9][a-z0-9 ]*[a-z0-9]$|^[a-z0-9]$/

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignWithClient[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [newCampaign, setNewCampaign] = useState({ name: '', client_id: '' })
  const supabase = createClient()

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id, company_name').order('company_name')
    setClients(data || [])
  }

  const createCampaign = async () => {
    const name = newCampaign.name.trim()
    if (!name || !NAME_REGEX.test(name)) {
      setCreateError('Only lowercase English letters, numbers, and spaces allowed')
      return
    }
    if (!newCampaign.client_id) {
      setCreateError('Select a client')
      return
    }

    setCreating(true)
    setCreateError('')
    try {
      const { data: existing } = await supabase
        .from('campaigns')
        .select('id')
        .ilike('name', name)
        .limit(1)

      if (existing && existing.length > 0) {
        setCreateError('A campaign with this name already exists')
        setCreating(false)
        return
      }

      await supabase.from('campaigns').insert({
        client_id: newCampaign.client_id,
        name: name,
        status: 'active',
      })
      setShowCreate(false)
      setNewCampaign({ name: '', client_id: '' })
      await loadCampaigns()
    } catch {
      setCreateError('Failed to create campaign')
    } finally {
      setCreating(false)
    }
  }

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
  useEffect(() => { loadClients() }, [])

  const updateStatus = async (campaignId: string, newStatus: string) => {
    await supabase.from('campaigns').update({ status: newStatus }).eq('id', campaignId)
    await loadCampaigns()
  }

  const deleteCampaign = async (campaignId: string, campaignName: string) => {
    if (!confirm(`Delete campaign "${campaignName}"? This will also delete all its media files. This cannot be undone.`)) return

    // Get campaign's group before deleting
    const campaignToDelete = campaigns.find(c => c.id === campaignId)
    const groupId = campaignToDelete?.device_group_id

    // Delete media first, then campaign
    await supabase.from('ad_media').delete().eq('campaign_id', campaignId)
    await supabase.from('campaigns').delete().eq('id', campaignId)

    // Auto-sync: re-push updated playlist to all devices in the group
    if (groupId) {
      await syncGroupDevices(groupId)
    }

    await loadCampaigns()
  }

  const syncGroupDevices = async (groupId: string) => {
    try {
      // Get remaining active campaigns in the group
      const { data: activeCampaigns } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('device_group_id', groupId)
        .eq('status', 'active')

      // Collect approved media from remaining campaigns
      const mediaItems: { url: string; type: string; duration: number }[] = []
      const campaignNames: string[] = []
      for (const c of activeCampaigns || []) {
        const { data: approved } = await supabase
          .from('ad_media')
          .select('file_url, file_type')
          .eq('campaign_id', c.id)
          .eq('status', 'approved')
        if (approved && approved.length > 0) {
          campaignNames.push(c.name)
          for (const m of approved) {
            mediaItems.push({
              url: m.file_url,
              type: m.file_type,
              duration: m.file_type.startsWith('video') ? 0 : 10,
            })
          }
        }
      }

      // Get online devices in the group
      const { data: groupDevices } = await supabase
        .from('devices')
        .select('id')
        .eq('group_id', groupId)
      const groupDeviceIds = new Set((groupDevices || []).map((d: { id: string }) => d.id))

      const devicesRes = await fetch('/api/devices')
      const deviceList = await devicesRes.json()
      const onlineDevices = (Array.isArray(deviceList) ? deviceList : deviceList.devices || [])
        .filter((d: { online: boolean; cardId: string }) => d.online && groupDeviceIds.has(d.cardId))

      // Push updated playlist or clear each device
      for (const device of onlineDevices) {
        if (mediaItems.length === 0) {
          await fetch('/api/devices/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cardId: device.cardId, action: 'clear-program' }),
          })
        } else {
          await fetch('/api/devices/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cardId: device.cardId,
              action: 'push-program',
              name: campaignNames.length === 1 ? campaignNames[0] : 'gzad playlist',
              mediaItems,
              schedule: { startTime: '00:00', endTime: '23:59' },
              width: 960,
              height: 320,
            }),
          })
        }
      }
    } catch (err) {
      console.error('Failed to sync devices after deletion:', err)
    }
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
      <div className="portal-page-header">
        <h1 className="portal-page-title">Manage Campaigns</h1>
        <button onClick={() => { setShowCreate(!showCreate); setCreateError('') }} className="portal-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {showCreate ? <X size={16} /> : <Plus size={16} />}
          {showCreate ? 'Cancel' : 'Create Campaign'}
        </button>
      </div>

      {showCreate && (
        <div style={{
          background: 'rgba(204,243,129,0.06)',
          border: '1px solid rgba(204,243,129,0.15)',
          borderRadius: 12,
          padding: '20px',
          marginBottom: 24,
        }}>
          <h3 style={{ color: '#CCF381', marginBottom: 16, fontSize: 15 }}>New Campaign</h3>
          {createError && (
            <div style={{ color: '#EF4444', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>
              {createError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="portal-input-group" style={{ flex: '1 1 200px' }}>
              <label>Campaign Name</label>
              <input
                type="text"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value.toLowerCase().replace(/[^a-z0-9 ]/g, '') })}
                placeholder="e.g. summer sale promo"
              />
              <span style={{ color: '#525252', fontSize: 11 }}>Lowercase English + numbers + spaces only</span>
            </div>
            <div className="portal-input-group" style={{ flex: '1 1 200px' }}>
              <label>Client</label>
              <select
                value={newCampaign.client_id}
                onChange={(e) => setNewCampaign({ ...newCampaign, client_id: e.target.value })}
                style={{ background: '#0A0A0A', border: '1px solid #27272a', borderRadius: 8, color: '#e4e4e7', padding: '8px 12px', fontSize: 14, width: '100%' }}
              >
                <option value="">Select client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={createCampaign}
              disabled={creating}
              className="portal-btn-primary"
              style={{ height: 40, whiteSpace: 'nowrap' }}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

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
                      <button
                        onClick={() => deleteCampaign(c.id, c.name)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '4px 10px', borderRadius: 6, fontSize: 12,
                          border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
                          color: '#EF4444', cursor: 'pointer', fontWeight: 500,
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
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
