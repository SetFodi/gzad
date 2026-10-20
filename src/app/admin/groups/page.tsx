'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Trash2, Monitor, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import AppDialog from '@/components/app/AppDialog'

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
  const [loadError, setLoadError] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      // Load groups
      const { data: groupData, error: groupsError } = await supabase
        .from('device_groups')
        .select('*')
        .order('created_at', { ascending: true })

      // Load all devices
      const { data: deviceData, error: devicesError } = await supabase
        .from('devices')
        .select('id, name, group_id')

      // Load campaign counts per group
      const { data: campaignData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('device_group_id')
        .not('device_group_id', 'is', null)

      if (groupsError || devicesError || campaignsError) throw groupsError || devicesError || campaignsError

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
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
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

  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>Could not load this page from the database. Please try again.</p>
        <button type="button" className="portal-btn-primary" onClick={() => void load()}>Try again</button>
      </div>
    </div>
  )

  if (loading) return <div className="portal-loading">Loading...</div>

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">Groups</h1>
          <p className="portal-subtitle">A group is a set of screens that play the same campaigns. Assign each screen to one group.</p>
        </div>
        <button type="button" onClick={() => { setShowCreate(true); setError('') }} className="portal-btn-primary">
          <Plus size={16} aria-hidden /> New group
        </button>
      </div>

      {showCreate && (
        <AppDialog labelledBy="new-group-title" onClose={() => setShowCreate(false)}>
            <div className="admin-modal-header">
              <h2 id="new-group-title">New group</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="admin-modal-close" aria-label="Close"><X size={20} /></button>
            </div>
            <form className="portal-form" onSubmit={(e) => { e.preventDefault(); createGroup() }}>
              {error && <div className="portal-login-error" role="alert">{error}</div>}
              <div className="portal-input-group">
                <label htmlFor="group-name">Name</label>
                <input
                  id="group-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Vake taxis, Airport line"
                  autoFocus
                />
              </div>
              <button type="submit" disabled={creating} className="portal-btn-primary full-width">
                {creating ? 'Creating…' : 'Create group'}
              </button>
            </form>
        </AppDialog>
      )}

      {unassigned.length > 0 && (
        <div className="portal-alert portal-alert-warning">
          <strong>{unassigned.length} {unassigned.length === 1 ? 'screen is' : 'screens are'} not in a group</strong> and won&apos;t get any campaigns until assigned.
          <div className="chip-row" style={{ marginTop: 10 }}>
            {unassigned.map(d => (
              <span key={d.id} className="device-chip">
                <Monitor size={13} aria-hidden />
                <code>{d.id}</code>
                {groups.length > 0 && (
                  <select
                    className="chip-select"
                    onChange={(e) => assignDevice(d.id, e.target.value || null)}
                    defaultValue=""
                    aria-label={`Assign ${d.id} to a group`}
                  >
                    <option value="">Assign to…</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="portal-empty">
          <p>No groups yet. Create one, then assign screens to it.</p>
        </div>
      ) : (
        <div className="group-grid">
          {groups.map(g => (
            <article key={g.id} className="group-card">
              <header className="group-card-head">
                <Link href={`/admin/groups/${g.id}`} className="group-card-title">
                  <span className="cell-stack">
                    <span className="group-card-name">{g.name}</span>
                    <span className="cell-sub">
                      {g.devices.length} {g.devices.length === 1 ? 'screen' : 'screens'} · {g.campaign_count} {g.campaign_count === 1 ? 'campaign' : 'campaigns'}
                    </span>
                  </span>
                  <ChevronRight size={18} aria-hidden className="attention-go" />
                </Link>
                <button
                  type="button"
                  onClick={() => deleteGroup(g.id)}
                  className="app-icon-btn danger"
                  aria-label={`Delete ${g.name}`}
                  title="Delete group"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </header>

              {g.devices.length === 0 ? (
                <p className="cell-sub" style={{ margin: 0 }}>
                  {unassigned.length > 0 ? 'No screens yet. Assign one from the list above.' : 'No screens yet. Move one here from another group.'}
                </p>
              ) : (
                <div className="chip-row">
                  {g.devices.map(d => (
                    <span key={d.id} className="device-chip">
                      <Monitor size={13} aria-hidden />
                      <code>{d.id}</code>
                      <button
                        type="button"
                        onClick={() => assignDevice(d.id, null)}
                        className="chip-remove"
                        aria-label={`Remove ${d.id} from ${g.name}`}
                        title="Remove from group"
                      >
                        <X size={12} aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
