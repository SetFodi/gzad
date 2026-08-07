'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { ArrowLeft, Check, X, Download, Send, Monitor, Upload } from 'lucide-react'
import Link from 'next/link'
import { SLOTS_PER_DEVICE } from '@/lib/slots'

const CAMPAIGN_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'paused_billing', label: 'Paused — no balance' },
  { value: 'completed', label: 'Completed' },
]

interface Campaign {
  id: string
  name: string
  status: string
  start_date: string
  end_date: string
  daily_hours: number
  taxi_count: number
  monthly_price: number
  device_group_id: string | null
  clients: { company_name: string; id: string } | null
}

interface DeviceGroup {
  id: string
  name: string
}

interface Media {
  id: string
  file_url: string
  file_type: string
  file_name: string
  status: string
  display_duration_seconds: number
}

export default function AdminCampaignDetailPage() {
  const params = useParams()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState('')
  const [pushing, setPushing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pushResult, setPushResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [groups, setGroups] = useState<DeviceGroup[]>([])
  const [form, setForm] = useState({
    start_date: '',
    end_date: '',
    daily_hours: 1,
    taxi_count: 1,
    monthly_price: 0,
  })
  const supabase = createClient()

  async function load() {
    const id = params.id as string

    const [campaignRes, mediaRes, groupsRes] = await Promise.all([
      supabase.from('campaigns').select('*, clients(company_name, id)').eq('id', id).single(),
      supabase.from('ad_media').select('*').eq('campaign_id', id).order('uploaded_at', { ascending: false }),
      supabase.from('device_groups').select('id, name').order('name'),
    ])

    setCampaign(campaignRes.data)
    setGroups(groupsRes.data || [])
    if (campaignRes.data?.device_group_id && !selectedGroup) {
      setSelectedGroup(campaignRes.data.device_group_id)
    }
    if (campaignRes.data) {
      setForm({
        start_date: campaignRes.data.start_date || '',
        end_date: campaignRes.data.end_date || '',
        daily_hours: campaignRes.data.daily_hours,
        taxi_count: campaignRes.data.taxi_count,
        monthly_price: campaignRes.data.monthly_price || 0,
      })
    }
    setMedia(mediaRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [params.id])

  // Anything that changes what should be on screen re-pushes the playlist.
  // Without this a device keeps playing whatever it was last sent — an approved
  // ad wouldn't air, and a paused one wouldn't stop.
  const resync = async (label: string) => {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: params.id as string }),
      })
      const result = await res.json()
      if (!res.ok) {
        setPushResult({ ok: false, msg: result.error || 'Sync failed' })
        return
      }
      if (result.groups === 0) {
        setPushResult({ ok: false, msg: `${label} saved — assign a device group to put it on air` })
        return
      }
      const overflow = result.overflow
        ? ` ${result.overflow} campaign(s) had no free slot.`
        : ''
      setPushResult({
        ok: true,
        msg: `${label} saved — ${result.media} item(s) pushed to ${result.synced}/${result.devices} device(s).${overflow}`,
      })
    } catch {
      setPushResult({ ok: false, msg: `${label} saved, but the Realtime Server is unreachable` })
    } finally {
      setSyncing(false)
    }
  }

  const updateMedia = async (mediaId: string, status: string) => {
    await supabase.from('ad_media').update({ status }).eq('id', mediaId)
    await load()
    await resync(status === 'approved' ? 'Approval' : 'Change')
  }

  const approveAllMedia = async () => {
    const pending = media.filter(m => m.status === 'pending_review')
    if (pending.length === 0) return
    await supabase
      .from('ad_media')
      .update({ status: 'approved' })
      .eq('campaign_id', params.id as string)
      .eq('status', 'pending_review')
    await load()
    await resync('Approval')
  }

  const updateMediaDuration = async (mediaId: string, seconds: number) => {
    await supabase.from('ad_media').update({ display_duration_seconds: seconds }).eq('id', mediaId)

    // Keep the campaign's billing slot_duration in sync (billed at the
    // longest media duration in the campaign)
    const { data: allMedia } = await supabase
      .from('ad_media')
      .select('display_duration_seconds')
      .eq('campaign_id', params.id as string)
    const maxDuration = Math.max(10, ...(allMedia || []).map(m => m.display_duration_seconds || 10))
    await supabase.from('campaigns').update({ slot_duration: maxDuration }).eq('id', params.id as string)

    await load()
    await resync('Duration')
  }

  const saveCampaign = async () => {
    await supabase.from('campaigns').update(form).eq('id', params.id as string)
    setEditMode(false)
    await load()
    await resync('Campaign')
  }

  const updateStatus = async (status: string) => {
    await supabase.from('campaigns').update({ status }).eq('id', params.id as string)
    await load()
    await resync('Status')
  }

  const downloadFile = async (url: string, fileName: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(url, '_blank')
    }
  }

  // Assigns the campaign to a group, then lets the server build and push the
  // playlist. The playlist itself is built once, in src/lib/slots.ts, so this
  // page can't drift from what billing and the slot view believe is on air.
  const pushToGroup = async () => {
    if (!campaign || !selectedGroup) return

    setPushing(true)
    setPushResult(null)
    try {
      if (campaign.device_group_id !== selectedGroup) {
        const { error } = await supabase
          .from('campaigns')
          .update({ device_group_id: selectedGroup })
          .eq('id', campaign.id)
        if (error) {
          setPushResult({ ok: false, msg: error.message })
          return
        }
      }

      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedGroup }),
      })
      const result = await res.json()

      if (!res.ok) {
        setPushResult({ ok: false, msg: result.error || 'Push failed' })
        return
      }

      const groupName = groups.find(g => g.id === selectedGroup)?.name || selectedGroup
      if (result.media === 0) {
        setPushResult({
          ok: false,
          msg: `No live campaigns with approved media in "${groupName}" — devices were cleared`,
        })
        return
      }

      const overflow = result.overflow
        ? ` ${result.overflow} campaign(s) exceeded the ${SLOTS_PER_DEVICE} slots available.`
        : ''
      setPushResult({
        ok: true,
        msg: `${result.media} item(s) pushed to ${result.synced}/${result.devices} device(s) in "${groupName}".${overflow}`,
      })
      await load()
    } catch {
      setPushResult({ ok: false, msg: 'Cannot reach Realtime Server' })
    } finally {
      setPushing(false)
    }
  }

  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; msg: string } | null>(null)

  const handleAdminUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !campaign) return
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    setUploadingMedia(true)
    setUploadMsg(null)
    try {
      for (const file of files) {
        const ext = file.name.split('.').pop()
        const path = `admin/${campaign.id}/${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('ad-media')
          .upload(path, file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('ad-media')
          .getPublicUrl(path)

        await supabase.from('ad_media').insert({
          campaign_id: campaign.id,
          file_url: publicUrl,
          file_type: file.type,
          file_name: file.name,
          status: 'approved', // Admin uploads are auto-approved
          display_duration_seconds: 10,
        })
      }
      setUploadMsg({ ok: true, msg: `${files.length} file(s) uploaded and auto-approved` })
      await load()
    } catch (err) {
      setUploadMsg({ ok: false, msg: err instanceof Error ? err.message : 'Upload failed' })
    } finally {
      setUploadingMedia(false)
      // Reset the input so same file can be re-uploaded
      e.target.value = ''
    }
  }

  if (loading) return <div className="portal-loading">Loading...</div>
  if (!campaign) return <div className="portal-loading">Campaign not found</div>

  return (
    <div className="portal-page">
      <Link href="/admin/campaigns" className="portal-back-link">
        <ArrowLeft size={16} /> Back to Campaigns
      </Link>

      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{campaign.name}</h1>
          <p className="portal-subtitle">{campaign.clients?.company_name}</p>
        </div>
        <div className="admin-header-actions">
          <select
            value={campaign.status}
            onChange={(e) => updateStatus(e.target.value)}
            disabled={syncing}
            title="Changing status re-pushes the playlist to this campaign's devices"
            style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13 }}
          >
            {CAMPAIGN_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button onClick={() => setEditMode(!editMode)} className="portal-btn-primary">
            {editMode ? 'Cancel' : 'Edit Details'}
          </button>
        </div>
      </div>

      {/* Push to Group */}
      <div style={{
        background: 'rgba(47, 125, 89, 0.14)',
        border: '1px solid rgba(47, 125, 89, 0.14)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Monitor size={18} style={{ color: 'var(--portal-success)' }} />
          <span style={{ fontWeight: 600, color: 'var(--portal-success)', fontSize: 15 }}>Push to Group</span>
          <span style={{ color: 'var(--portal-muted)', fontSize: 12, marginLeft: 4 }}>
            ({media.filter(m => m.status === 'approved').length} approved file{media.filter(m => m.status === 'approved').length !== 1 ? 's' : ''})
          </span>
        </div>

        {groups.length === 0 ? (
          <p style={{ color: 'var(--portal-muted)', fontSize: 13, margin: 0 }}>
            No groups created yet. Go to <Link href="/admin/groups" style={{ color: 'var(--portal-info)' }}>Groups</Link> to create one and assign devices.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                style={{
                  background: 'var(--portal-surface)',
                  border: '1px solid var(--portal-border)',
                  borderRadius: 8,
                  color: 'var(--portal-text)',
                  padding: '8px 12px',
                  fontSize: 14,
                  minWidth: 200,
                }}
              >
                <option value="">Select a group...</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <button
                onClick={pushToGroup}
                disabled={pushing || !selectedGroup || !media.some(m => m.status === 'approved')}
                className="portal-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: (pushing || !selectedGroup) ? 0.6 : 1 }}
              >
                <Send size={16} />
                {pushing ? 'Pushing...' : 'Push to Group'}
              </button>
            </div>

            {!selectedGroup && (
              <span style={{ color: 'var(--portal-warning)', fontSize: 12, display: 'block', marginTop: 10 }}>Select a group to push to</span>
            )}
            {selectedGroup && !media.some(m => m.status === 'approved') && (
              <span style={{ color: 'var(--portal-warning)', fontSize: 12, display: 'block', marginTop: 10 }}>Approve a media file first</span>
            )}
          </>
        )}

        {pushResult && (
          <div style={{
            marginTop: 10,
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
            background: pushResult.ok ? 'rgba(47, 125, 89, 0.14)' : 'rgba(163, 58, 58, 0.14)',
            color: pushResult.ok ? 'var(--portal-success)' : 'var(--portal-danger)',
          }}>
            {pushResult.msg}
          </div>
        )}
      </div>

      {editMode ? (
        <div className="portal-section">
          <h2>Campaign Details</h2>
          <div className="admin-edit-form">
            <div className="admin-form-row">
              <div className="portal-input-group">
                <label>Start Date</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="portal-input-group">
                <label>End Date</label>
                <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="admin-form-row">
              <div className="portal-input-group">
                <label>Daily Hours</label>
                <input type="number" value={form.daily_hours} onChange={(e) => setForm({ ...form, daily_hours: parseInt(e.target.value) })} min={1} max={24} />
              </div>
              <div className="portal-input-group">
                <label>Taxi Count</label>
                <input type="number" value={form.taxi_count} onChange={(e) => setForm({ ...form, taxi_count: parseInt(e.target.value) })} min={1} />
              </div>
              <div className="portal-input-group">
                <label>Monthly Price (GEL)</label>
                <input type="number" value={form.monthly_price} onChange={(e) => setForm({ ...form, monthly_price: parseFloat(e.target.value) })} min={0} />
              </div>
            </div>
            <button onClick={saveCampaign} className="portal-btn-primary">Save Changes</button>
          </div>
        </div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-info">
              <span className="stat-card-value">{campaign.start_date || '—'}</span>
              <span className="stat-card-label">Start Date</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-info">
              <span className="stat-card-value">{campaign.end_date || '—'}</span>
              <span className="stat-card-label">End Date</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-info">
              <span className="stat-card-value">{campaign.daily_hours}h / {campaign.taxi_count} taxis</span>
              <span className="stat-card-label">Coverage</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-info">
              <span className="stat-card-value">{campaign.monthly_price ? `${campaign.monthly_price} GEL` : '—'}</span>
              <span className="stat-card-label">Monthly Price</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-info">
              <span className="stat-card-value">{groups.find(g => g.id === campaign.device_group_id)?.name || 'All devices'}</span>
              <span className="stat-card-label">Device Group</span>
            </div>
          </div>
        </div>
      )}

      {/* Media Upload + Review */}
      <div className="portal-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0 }}>Ad Media ({media.length})</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {media.some(m => m.status === 'pending_review') && (
              <button
                onClick={approveAllMedia}
                className="portal-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}
              >
                <Check size={16} />
                Approve All ({media.filter(m => m.status === 'pending_review').length})
              </button>
            )}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid var(--portal-border)',
                background: 'rgba(255, 249, 240, 0.72)',
                color: 'var(--portal-text)',
                cursor: uploadingMedia ? 'wait' : 'pointer',
                fontSize: 14,
                fontWeight: 500,
                opacity: uploadingMedia ? 0.6 : 1,
              }}
            >
              <Upload size={16} />
              {uploadingMedia ? 'Uploading...' : 'Upload Media'}
              <input
                type="file"
                multiple
                accept="image/*,video/mp4"
                onChange={handleAdminUpload}
                disabled={uploadingMedia}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        {uploadMsg && (
          <div style={{
            marginBottom: 12,
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
            background: uploadMsg.ok ? 'rgba(47, 125, 89, 0.14)' : 'rgba(163, 58, 58, 0.14)',
            color: uploadMsg.ok ? 'var(--portal-success)' : 'var(--portal-danger)',
          }}>
            {uploadMsg.msg}
          </div>
        )}

        {media.length === 0 ? (
          <p className="portal-empty-text">No media uploaded yet. Use the button above to add files.</p>
        ) : (
          <div className="admin-media-review">
            {media.map((m) => (
              <div key={m.id} className="admin-media-card">
                <div className="admin-media-preview">
                  {m.file_type.startsWith('image') ? (
                    <img src={m.file_url} alt={m.file_name} />
                  ) : (
                    <video src={m.file_url} controls />
                  )}
                </div>
                <div className="admin-media-info">
                  <span className="admin-media-name">{m.file_name}</span>
                  <span className="status-badge" style={{
                    color: m.status === 'approved' ? 'var(--portal-success)' : m.status === 'rejected' ? 'var(--portal-danger)' : 'var(--portal-warning)',
                    borderColor: m.status === 'approved' ? 'var(--portal-success)' : m.status === 'rejected' ? 'var(--portal-danger)' : 'var(--portal-warning)',
                  }}>
                    {m.status.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: 'var(--portal-muted)' }}>Duration:</span>
                  {[10, 20, 30].map(sec => {
                    const active = (m.display_duration_seconds || 10) === sec
                    return (
                      <button
                        key={sec}
                        onClick={() => updateMediaDuration(m.id, sec)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: active ? 'rgba(47, 125, 89, 0.14)' : 'rgba(255, 249, 240, 0.72)',
                          border: `1px solid ${active ? 'rgba(47, 125, 89, 0.14)' : 'var(--portal-border)'}`,
                          color: active ? 'var(--portal-success)' : 'var(--portal-muted)',
                        }}
                      >
                        {sec}s
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Download button */}
                  <button
                    onClick={() => downloadFile(m.file_url, m.file_name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--portal-border)',
                      background: 'rgba(255, 249, 240, 0.72)',
                      color: 'var(--portal-text-soft)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      transition: 'all 0.15s',
                    }}
                  >
                    <Download size={14} /> Download
                  </button>
                  {/* Approve/Reject */}
                  {m.status === 'pending_review' && (
                    <>
                      <button className="action-btn approve" onClick={() => updateMedia(m.id, 'approved')}>
                        <Check size={16} /> Approve
                      </button>
                      <button className="action-btn reject" onClick={() => updateMedia(m.id, 'rejected')}>
                        <X size={16} /> Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
