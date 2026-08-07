'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Trash2, Monitor, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface DeviceGroup {
  id: string
  name: string
  created_at: string
  devices: { id: string; name: string | null }[]
  campaign_count: number
}

interface DeviceOption {
  id: string
  name: string | null
  group_id: string | null
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<DeviceGroup[]>([])
  const [unassigned, setUnassigned] = useState<DeviceOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const load = async () => {
    // Load groups
    const { data: groupData } = await supabase
      .from('device_groups')
      .select('*')
      .order('created_at', { ascending: true })

    // Load all devices
    const { data: deviceData } = await supabase
      .from('devices')
      .select('id, name, group_id')

    // Load campaign counts per group
    const { data: campaignData } = await supabase
      .from('campaigns')
      .select('device_group_id')
      .not('device_group_id', 'is', null)

    const campaignCounts: Record<string, number> = {}
    for (const c of campaignData || []) {
      campaignCounts[c.device_group_id] = (campaignCounts[c.device_group_id] || 0) + 1
    }

    const devices = deviceData || []
    const enriched = (groupData || []).map(g => ({
      ...g,
      devices: devices.filter(d => d.group_id === g.id),
      campaign_count: campaignCounts[g.id] || 0,
    }))

    setGroups(enriched)
    setUnassigned(devices.filter(d => !d.group_id))
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/immutability -- load() is async: state is set once the query resolves, not during render
  useEffect(() => { load() }, [])

  const createGroup = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    setError('')
    const { error: err } = await supabase.from('device_groups').insert({ name })
    if (err) {
      setError(err.message.includes('unique') ? 'Group name already exists' : err.message)
    } else {
      setNewName('')
      setShowCreate(false)
      await load()
    }
    setCreating(false)
  }

  const deleteGroup = async (id: string) => {
    if (!confirm('Delete this group? Devices will become unassigned.')) return
    // Unassign devices first
    await supabase.from('devices').update({ group_id: null }).eq('group_id', id)
    // Unassign campaigns
    await supabase.from('campaigns').update({ device_group_id: null }).eq('device_group_id', id)
    await supabase.from('device_groups').delete().eq('id', id)
    await load()
  }

  const assignDevice = async (deviceId: string, groupId: string | null) => {
    await supabase.from('devices').update({ group_id: groupId }).eq('id', deviceId)
    await load()

    // If assigning to a group, push that group's ads to the new device
    if (groupId) {
      await pushGroupAdsToDevice(groupId, deviceId)
    }
  }

  const pushGroupAdsToDevice = async (groupId: string, deviceId: string) => {
    try {
      // Check if device is online
      const devicesRes = await fetch('/api/devices')
      const deviceList = await devicesRes.json()
      const allDevices = Array.isArray(deviceList) ? deviceList : deviceList.devices || []
      const device = allDevices.find((d: { cardId: string; online: boolean }) => d.cardId === deviceId && d.online)
      if (!device) return // Device offline, will get ads on next manual push

      // Get active campaigns in this group
      const { data: activeCampaigns } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('status', 'active')
        .eq('device_group_id', groupId)

      const mediaItems: { url: string; type: string; duration: number; campaignName: string }[] = []
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
              duration: m.file_type.startsWith('video') ? 30 : 10,
              campaignName: c.name,
            })
          }
        }
      }

      if (mediaItems.length === 0) return // No ads to push

      await fetch('/api/devices/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: deviceId,
          action: 'push-program',
          name: campaignNames.length === 1 ? campaignNames[0] : 'gzad playlist',
          mediaItems,
          schedule: { startTime: '00:00', endTime: '23:59' },
          width: 240,
          height: 80,
        }),
      })
    } catch (err) {
      console.error('Failed to push group ads to device:', err)
    }
  }

  if (loading) return <div className="portal-loading">Loading...</div>

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <h1 className="portal-page-title">Device Groups</h1>
        <button
          onClick={() => { setShowCreate(!showCreate); setError('') }}
          className="portal-btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {showCreate ? <X size={16} /> : <Plus size={16} />}
          {showCreate ? 'Cancel' : 'New Group'}
        </button>
      </div>

      {showCreate && (
        <div className="portal-panel" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Create Group</h3>
          {error && (
            <div className="portal-alert portal-alert-danger" style={{ marginBottom: 12 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div className="portal-input-group" style={{ flex: 1 }}>
              <label>Group Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Fleet A, Downtown Taxis"
                onKeyDown={(e) => e.key === 'Enter' && createGroup()}
              />
            </div>
            <button onClick={createGroup} disabled={creating} className="portal-btn-primary" style={{ height: 40 }}>
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Unassigned devices */}
      {unassigned.length > 0 && (
        <div className="portal-panel" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--portal-warning)', marginBottom: 10 }}>
            Unassigned Devices ({unassigned.length})
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {unassigned.map(d => (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255, 249, 240, 0.72)', border: '1px solid var(--portal-border)', borderRadius: 8,
                padding: '8px 12px', fontSize: 13,
              }}>
                <Monitor size={14} style={{ color: 'var(--portal-primary)' }} />
                <span style={{ color: 'var(--portal-text)', fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{d.id}</span>
                {groups.length > 0 && (
                  <select
                    onChange={(e) => assignDevice(d.id, e.target.value || null)}
                    defaultValue=""
                  >
                    <option value="">Assign to...</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Groups */}
      {groups.length === 0 ? (
        <div className="portal-empty">
          <p>No groups yet. Create one to organize your devices.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map(g => (
            <div key={g.id} className="campaign-card" style={{ cursor: 'default' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Link href={`/admin/groups/${g.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--portal-text)', margin: 0 }}>{g.name}</h3>
                    <span style={{ fontSize: 13, color: 'var(--portal-muted)' }}>
                      {g.devices.length} device{g.devices.length !== 1 ? 's' : ''} · {g.campaign_count} campaign{g.campaign_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ChevronRight size={18} style={{ color: 'var(--portal-muted)', marginLeft: 'auto' }} />
                </Link>
                <button
                  onClick={() => deleteGroup(g.id)}
                  className="action-btn reject"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>

              {g.devices.length === 0 ? (
                <div style={{ color: 'var(--portal-muted)', fontSize: 14, padding: '10px 0' }}>
                  No devices in this group. Assign devices from the unassigned list above.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {g.devices.map(d => (
                    <div key={d.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'var(--portal-primary-soft)', border: '1px solid var(--portal-border)',
                      borderRadius: 8, padding: '6px 10px', fontSize: 12,
                    }}>
                      <Monitor size={12} style={{ color: 'var(--portal-primary)' }} />
                      <span style={{ color: 'var(--portal-primary)', fontFamily: 'monospace', fontWeight: 700 }}>{d.id}</span>
                      <button
                        onClick={() => assignDevice(d.id, null)}
                        style={{
                          background: 'none', border: 'none', color: 'var(--portal-muted)',
                          cursor: 'pointer', padding: 2, display: 'flex',
                        }}
                        title="Remove from group"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
