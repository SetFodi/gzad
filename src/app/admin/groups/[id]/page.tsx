'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Megaphone, ChevronDown, ChevronRight, Plus, Send, Wifi, WifiOff } from 'lucide-react'

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
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [onlineDeviceIds, setOnlineDeviceIds] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const supabase = createClient()

  const load = async () => {
    const [groupRes, devicesRes, campaignsRes, unassignedRes] = await Promise.all([
      supabase.from('device_groups').select('*').eq('id', groupId).single(),
      supabase.from('devices').select('id, name, last_lat, last_lng').eq('group_id', groupId),
      supabase.from('campaigns').select('id, name, status, start_date, end_date, device_group_id, clients(company_name)').eq('device_group_id', groupId).order('created_at', { ascending: false }),
      supabase.from('campaigns').select('id, name').is('device_group_id', null).eq('status', 'active'),
    ])

    setGroup(groupRes.data)
    setDevices(devicesRes.data || [])
    setUnassignedCampaigns(unassignedRes.data || [])

    // Get approved media counts + first media thumbnail per campaign
    const campaignList = campaignsRes.data || []
    if (campaignList.length > 0) {
      const ids = campaignList.map(c => c.id)
      const [{ data: mediaData }, { data: allFirstMedia }] = await Promise.all([
        supabase.from('ad_media').select('campaign_id').in('campaign_id', ids).eq('status', 'approved'),
        supabase.from('ad_media').select('campaign_id, file_url, file_type').in('campaign_id', ids).order('uploaded_at', { ascending: true }),
      ])

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

    setLoading(false)
  }

  const loadOnlineDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/devices')
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.devices || []
      setOnlineDeviceIds(new Set(list.filter((d: { online: boolean }) => d.online).map((d: { cardId: string }) => d.cardId)))
    } catch {
      // Realtime server not running
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

  if (loading) return <div className="portal-loading">Loading...</div>
  if (!group) return <div className="portal-loading">Group not found</div>

  const statusColor = (s: string) =>
    s === 'active' ? '#CCF381' : s === 'completed' ? '#60A5FA' : s === 'paused' ? '#FBBF24' : '#71717a'

  return (
    <div className="portal-page">
      <Link href="/admin/groups" className="portal-back-link">
        <ArrowLeft size={16} /> Back to Groups
      </Link>

      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{group.name}</h1>
          <p className="portal-subtitle">
            {devices.length} device{devices.length !== 1 ? 's' : ''} ({devices.filter(d => onlineDeviceIds.has(d.id)).length} online) · {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={syncGroupToDevices}
          disabled={syncing}
          className="portal-btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: syncing ? 0.6 : 1 }}
        >
          <Send size={16} />
          {syncing ? 'Pushing...' : 'Push Ads to Devices'}
        </button>
      </div>

      {syncResult && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: syncResult.ok ? 'rgba(204,243,129,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${syncResult.ok ? 'rgba(204,243,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          color: syncResult.ok ? '#CCF381' : '#EF4444',
        }}>
          {syncResult.msg}
        </div>
      )}

      {/* Campaigns assigned to this group */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e4e4e7', margin: 0 }}>
            Campaigns in this Group
          </h2>
          {unassignedCampaigns.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                id="assign-campaign"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    assignCampaign(e.target.value)
                    e.target.value = ''
                  }
                }}
                disabled={assigning}
                style={{
                  background: '#0A0A0A', border: '1px solid #27272a', borderRadius: 8,
                  color: '#e4e4e7', padding: '8px 12px', fontSize: 13,
                }}
              >
                <option value="">
                  {assigning ? 'Assigning...' : 'Assign campaign...'}
                </option>
                {unassignedCampaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Plus size={16} style={{ color: '#71717a' }} />
            </div>
          )}
        </div>

        {campaigns.length === 0 ? (
          <div style={{
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.15)',
            borderRadius: 12, padding: '16px 20px',
          }}>
            <p style={{ color: '#FBBF24', fontSize: 13, margin: 0 }}>
              No campaigns assigned to this group yet. Assign one above, or go to a campaign&apos;s detail page → Edit Details → set Device Group.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {campaigns.map(c => (
              <div key={c.id} style={{
                background: '#0A0A0A', border: '1px solid #1a1a1a',
                borderRadius: 10, padding: '14px 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {c.first_media_url ? (
                    c.first_media_type?.startsWith('video') ? (
                      <video
                        src={c.first_media_url}
                        muted
                        style={{ width: 56, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #27272a', background: '#000', flexShrink: 0 }}
                      />
                    ) : (
                      <img
                        src={c.first_media_url}
                        alt=""
                        style={{ width: 56, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid #27272a', background: '#000', flexShrink: 0 }}
                      />
                    )
                  ) : (
                    <Megaphone size={16} style={{ color: statusColor(c.status), flexShrink: 0 }} />
                  )}
                  <div>
                    <Link
                      href={`/admin/campaigns/${c.id}`}
                      style={{ color: '#e4e4e7', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}
                    >
                      {c.name}
                    </Link>
                    <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>
                      {c.clients?.company_name || 'No client'} · {c.approved_count} approved file{c.approved_count !== 1 ? 's' : ''}
                      {c.start_date && c.end_date && (
                        <span> · {c.start_date} to {c.end_date}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: statusColor(c.status),
                    background: `${statusColor(c.status)}15`,
                    border: `1px solid ${statusColor(c.status)}30`,
                    borderRadius: 6, padding: '3px 10px', textTransform: 'uppercase',
                  }}>
                    {c.status}
                  </span>
                  <button
                    onClick={() => unassignCampaign(c.id)}
                    style={{
                      background: 'none', border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: 6, color: '#EF4444', cursor: 'pointer',
                      padding: '4px 10px', fontSize: 11, fontWeight: 500,
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Devices in this group */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#e4e4e7', marginBottom: 14 }}>
          Devices in this Group
        </h2>

        {devices.length === 0 ? (
          <div style={{
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.15)',
            borderRadius: 12, padding: '16px 20px',
          }}>
            <p style={{ color: '#FBBF24', fontSize: 13, margin: 0 }}>
              No devices in this group. Go to <Link href="/admin/groups" style={{ color: '#60A5FA' }}>Groups</Link> to assign devices.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {devices.map(d => {
              const isExpanded = expandedDevice === d.id
              return (
                <div key={d.id} style={{
                  background: '#0A0A0A', border: '1px solid #1a1a1a',
                  borderRadius: 10, overflow: 'hidden',
                }}>
                  <button
                    onClick={() => setExpandedDevice(isExpanded ? null : d.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '14px 18px', background: 'none', border: 'none',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {isExpanded ? <ChevronDown size={16} style={{ color: '#CCF381' }} /> : <ChevronRight size={16} style={{ color: '#71717a' }} />}
                    {onlineDeviceIds.has(d.id) ? <Wifi size={14} style={{ color: '#CCF381' }} /> : <WifiOff size={14} style={{ color: '#3f3f46' }} />}
                    <span style={{ color: onlineDeviceIds.has(d.id) ? '#CCF381' : '#71717a', fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{d.id}</span>
                    {d.name && <span style={{ color: '#71717a', fontSize: 12 }}>({d.name})</span>}
                    <span style={{ color: onlineDeviceIds.has(d.id) ? '#CCF381' : '#3f3f46', fontSize: 12, marginLeft: 'auto' }}>
                      {onlineDeviceIds.has(d.id) ? 'online' : 'offline'}
                    </span>
                  </button>

                  {isExpanded && (
                    <div style={{ padding: '0 18px 14px 44px', borderTop: '1px solid #141414' }}>
                      {campaigns.length === 0 ? (
                        <p style={{ color: '#3f3f46', fontSize: 13, margin: '12px 0 0' }}>
                          No campaigns targeting this group yet.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                          {campaigns.map(c => (
                            <Link
                              key={c.id}
                              href={`/admin/campaigns/${c.id}`}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 14px', borderRadius: 8,
                                background: 'rgba(204,243,129,0.04)',
                                border: '1px solid rgba(204,243,129,0.1)',
                                textDecoration: 'none',
                              }}
                            >
                              {c.first_media_url ? (
                                c.first_media_type?.startsWith('video') ? (
                                  <video
                                    src={c.first_media_url}
                                    muted
                                    style={{ width: 48, height: 30, objectFit: 'cover', borderRadius: 3, border: '1px solid #27272a', background: '#000', flexShrink: 0 }}
                                  />
                                ) : (
                                  <img
                                    src={c.first_media_url}
                                    alt=""
                                    style={{ width: 48, height: 30, objectFit: 'cover', borderRadius: 3, border: '1px solid #27272a', background: '#000', flexShrink: 0 }}
                                  />
                                )
                              ) : (
                                <Megaphone size={14} style={{ color: statusColor(c.status), flexShrink: 0 }} />
                              )}
                              <div style={{ flex: 1 }}>
                                <div style={{ color: '#e4e4e7', fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                                <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>
                                  {c.clients?.company_name} · {c.approved_count} file{c.approved_count !== 1 ? 's' : ''} · {c.status}
                                </div>
                              </div>
                              <span style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: statusColor(c.status), flexShrink: 0,
                              }} />
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
