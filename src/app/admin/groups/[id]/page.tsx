'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Monitor, Send } from 'lucide-react'
import StatusBadge from '@/components/app/StatusBadge'

interface DeviceGroup {
  id: string
  name: string
  created_at: string
}

interface DeviceRow {
  id: string
  name: string | null
  last_lat: number | null
  last_lng: number | null
}

interface CampaignRow {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
  device_group_id: string | null
  clients: { company_name: string } | null
  approved_count: number
  first_media_url?: string
  first_media_type?: string
}

export default function GroupDetailPage() {
  const params = useParams()
  const groupId = params.id as string
  const [group, setGroup] = useState<DeviceGroup | null>(null)
  const [devices, setDevices] = useState<DeviceRow[]>([])
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [unassignedCampaigns, setUnassignedCampaigns] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [onlineDeviceIds, setOnlineDeviceIds] = useState<Set<string> | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const [groupRes, devicesRes, campaignsRes, unassignedRes] = await Promise.all([
        supabase.from('device_groups').select('*').eq('id', groupId).maybeSingle(),
        supabase.from('devices').select('id, name, last_lat, last_lng').eq('group_id', groupId),
        supabase.from('campaigns').select('id, name, status, start_date, end_date, device_group_id, clients(company_name)').eq('device_group_id', groupId).order('created_at', { ascending: false }),
        supabase.from('campaigns').select('id, name').is('device_group_id', null).eq('status', 'active'),
      ])

      const failedRead = [groupRes, devicesRes, campaignsRes, unassignedRes].find(result => result.error)
      if (failedRead) throw failedRead.error

      setGroup(groupRes.data)
      setDevices(devicesRes.data || [])
      setUnassignedCampaigns(unassignedRes.data || [])

      // Get approved media counts + first media thumbnail per campaign
      const campaignList = campaignsRes.data || []
      if (campaignList.length > 0) {
        const ids = campaignList.map(c => c.id)
        const [mediaRes, firstMediaRes] = await Promise.all([
          supabase.from('ad_media').select('campaign_id').in('campaign_id', ids).eq('status', 'approved'),
          supabase.from('ad_media').select('campaign_id, file_url, file_type').in('campaign_id', ids).order('uploaded_at', { ascending: true }),
        ])

        if (mediaRes.error || firstMediaRes.error) throw mediaRes.error || firstMediaRes.error
        const mediaData = mediaRes.data
        const allFirstMedia = firstMediaRes.data

        const counts: Record<string, number> = {}
        for (const m of mediaData || []) {
          counts[m.campaign_id] = (counts[m.campaign_id] || 0) + 1
        }

        // Get first media per campaign
        const firstMediaMap: Record<string, { file_url: string; file_type: string }> = {}
        for (const m of allFirstMedia || []) {
          if (!firstMediaMap[m.campaign_id]) {
            firstMediaMap[m.campaign_id] = m
          }
        }

        setCampaigns(campaignList.map(c => ({
          ...c,
          clients: Array.isArray(c.clients) ? c.clients[0] || null : c.clients,
          approved_count: counts[c.id] || 0,
          first_media_url: firstMediaMap[c.id]?.file_url,
          first_media_type: firstMediaMap[c.id]?.file_type,
        })) as CampaignRow[])
      } else {
        setCampaigns([])
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const loadOnlineDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/devices')
      const data = await res.json()
      if (!res.ok || data.realtimeError) throw new Error('Live status unavailable')
      const list = Array.isArray(data) ? data : data.devices || []
      setOnlineDeviceIds(new Set(list.filter((d: { online: boolean }) => d.online).map((d: { cardId: string }) => d.cardId)))
    } catch {
      setOnlineDeviceIds(null)
    }
  }, [])

  useEffect(() => { load(); loadOnlineDevices() }, [groupId])

  const syncGroupToDevices = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      // Fetch fresh from DB (not stale React state)
      const { data: activeCampaigns } = await supabase
        .from('campaigns')
        .select('id, name')
        .eq('status', 'active')
        .eq('device_group_id', groupId)

      // Collect approved media
      const mediaItems: { url: string; type: string; duration: number; campaignName: string }[] = []
      const campaignNames: string[] = []
      for (const c of activeCampaigns || []) {
        const { data: approved } = await supabase
          .from('ad_media')
          .select('file_url, file_type, display_duration_seconds')
          .eq('campaign_id', c.id)
          .eq('status', 'approved')
        if (approved && approved.length > 0) {
          campaignNames.push(c.name)
          for (const m of approved) {
            mediaItems.push({
              url: m.file_url,
              type: m.file_type,
              duration: m.display_duration_seconds || 10,
              campaignName: c.name,
            })
          }
        }
      }

      // Get online devices in this group (fresh from DB + API)
      const { data: groupDevices } = await supabase
        .from('devices')
        .select('id')
        .eq('group_id', groupId)
      const groupDeviceIds = new Set((groupDevices || []).map((d: { id: string }) => d.id))

      const devicesRes = await fetch('/api/devices')
      const deviceList = await devicesRes.json()
      const onlineInGroup = (Array.isArray(deviceList) ? deviceList : deviceList.devices || [])
        .filter((d: { online: boolean; cardId: string }) => d.online && groupDeviceIds.has(d.cardId))

      if (onlineInGroup.length === 0) {
        setSyncResult({ ok: false, msg: 'No online devices in this group' })
        setSyncing(false)
        return
      }

      let pushed = 0
      for (const device of onlineInGroup) {
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
              width: 240,
              height: 80,
            }),
          })
        }
        pushed++
      }

      const action = mediaItems.length === 0 ? 'Cleared' : `Pushed ${mediaItems.length} ad(s) from ${campaignNames.length} campaign(s)`
      setSyncResult({ ok: true, msg: `${action} to ${pushed} device(s)` })
    } catch (err) {
      setSyncResult({ ok: false, msg: err instanceof Error ? err.message : 'Sync failed' })
    } finally {
      setSyncing(false)
    }
  }

  const assignCampaign = async (campaignId: string) => {
    setAssigning(true)
    await supabase.from('campaigns').update({ device_group_id: groupId }).eq('id', campaignId)
    await load()
    setAssigning(false)
  }

  const unassignCampaign = async (campaignId: string) => {
    await supabase.from('campaigns').update({ device_group_id: null }).eq('id', campaignId)
    await load()
    // Re-push remaining group ads to devices (removed campaign should stop playing)
    await syncGroupToDevices()
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
  if (!group) return <div className="portal-loading">Group not found</div>

  const onlineCount = onlineDeviceIds ? devices.filter(d => onlineDeviceIds.has(d.id)).length : null

  return (
    <div className="portal-page">
      <Link href="/admin/groups" className="portal-back-link">
        <ArrowLeft size={16} /> Groups
      </Link>

      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{group.name}</h1>
          <p className="portal-subtitle">
            {devices.length} {devices.length === 1 ? 'screen' : 'screens'} ({onlineCount === null ? 'live status unavailable' : `${onlineCount} online`}) · {campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'}
          </p>
        </div>
        <button type="button" onClick={syncGroupToDevices} disabled={syncing} className="portal-btn-primary">
          <Send size={16} aria-hidden />
          {syncing ? 'Pushing…' : 'Push ads to screens'}
        </button>
      </div>

      {syncResult && (
        <div className={`portal-alert ${syncResult.ok ? 'portal-alert-success' : 'portal-alert-danger'}`} role="status">
          {syncResult.msg}
        </div>
      )}

      <section className="portal-section" style={{ marginTop: 8 }}>
        <div className="section-head">
          <h2>Campaigns</h2>
          {unassignedCampaigns.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  assignCampaign(e.target.value)
                  e.target.value = ''
                }
              }}
              disabled={assigning}
              aria-label="Add a campaign to this group"
              style={{ width: 'auto', minHeight: 36 }}
            >
              <option value="">{assigning ? 'Adding…' : '+ Add campaign…'}</option>
              {unassignedCampaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {campaigns.length === 0 ? (
          <div className="portal-alert portal-alert-warning" style={{ margin: 0 }}>
            No campaigns in this group yet, so its screens only play house ads. Add one above.
          </div>
        ) : (
          <div className="campaigns-table-wrapper">
            <ul className="recent-list">
              {campaigns.map(c => (
                <li key={c.id} className="recent-row group-campaign-row" style={{ cursor: 'default' }}>
                  <div className="cell-media" style={{ flex: 1 }}>
                    <div className="cell-thumb">
                      {c.first_media_url && (
                        c.first_media_type?.startsWith('video')
                          ? <video src={c.first_media_url} muted playsInline preload="metadata" />
                          // eslint-disable-next-line @next/next/no-img-element
                          : <img src={c.first_media_url} alt="" loading="lazy" />
                      )}
                    </div>
                    <div className="cell-stack">
                      <Link href={`/admin/campaigns/${c.id}`} className="table-link">{c.name}</Link>
                      <span className="cell-sub">
                        {c.clients?.company_name || 'No client'} · {c.approved_count} approved {c.approved_count === 1 ? 'file' : 'files'}
                        {c.start_date && c.end_date && ` · ${c.start_date} → ${c.end_date}`}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                  <button type="button" className="action-btn" onClick={() => unassignCampaign(c.id)}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="portal-section">
        <h2>Screens</h2>
        {devices.length === 0 ? (
          <div className="portal-alert portal-alert-warning" style={{ margin: 0 }}>
            No screens in this group. Assign them on the <Link href="/admin/groups" className="section-link">Groups</Link> page.
          </div>
        ) : (
          <div className="campaigns-table-wrapper">
            <ul className="recent-list">
              {devices.map(d => {
                const online = onlineDeviceIds?.has(d.id) ?? null
                return (
                  <li key={d.id} className="recent-row" style={{ cursor: 'default' }}>
                    <span className="device-presence" data-online={online || undefined} aria-hidden />
                    <div className="cell-stack" style={{ flex: 1 }}>
                      <span className="recent-name"><Monitor size={14} aria-hidden style={{ verticalAlign: -2, marginRight: 6, color: 'var(--portal-faint)' }} />{d.name || d.id}</span>
                      {d.name && <span className="cell-sub"><code>{d.id}</code></span>}
                    </div>
                    <StatusBadge status={online === null ? 'unknown' : online ? 'online' : 'offline'}>{online === null ? 'Unknown' : online ? 'Online' : 'Offline'}</StatusBadge>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
