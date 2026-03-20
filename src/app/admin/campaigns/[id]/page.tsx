'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { ArrowLeft, Check, X, DollarSign, Copy, Download, Send, Monitor, Upload, MapPin } from 'lucide-react'
import Link from 'next/link'
import { DISTRICT_NAMES } from '@/lib/districts'

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
  districts: string[] | null
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
}

export default function AdminCampaignDetailPage() {
  const params = useParams()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState('')
  const [pushing, setPushing] = useState(false)
  const [pushResult, setPushResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [districtEdit, setDistrictEdit] = useState(false)
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([])
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
    setSelectedDistricts(campaignRes.data?.districts || [])
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

  const updateMedia = async (mediaId: string, status: string) => {
    await supabase.from('ad_media').update({ status }).eq('id', mediaId)
    await load()
  }

  const saveCampaign = async () => {
    await supabase.from('campaigns').update(form).eq('id', params.id as string)
    setEditMode(false)
    await load()
  }

  const saveDistricts = async () => {
    const value = selectedDistricts.length > 0 ? selectedDistricts : null
    await supabase.from('campaigns').update({ districts: value }).eq('id', params.id as string)
    setDistrictEdit(false)
    await load()
  }

  const createInvoice = async () => {
    if (!campaign?.clients?.id || !campaign.monthly_price) return
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    await supabase.from('invoices').insert({
      client_id: campaign.clients.id,
      campaign_id: campaign.id,
      amount: campaign.monthly_price,
      status: 'pending',
      due_date: dueDate.toISOString().split('T')[0],
    })
    alert('Invoice created')
  }

  const copyName = () => {
    if (!campaign) return
    navigator.clipboard.writeText(campaign.name)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  const pushToGroup = async () => {
    if (!campaign || !selectedGroup) return

    setPushing(true)
    setPushResult(null)
    try {
      // 1. Assign this campaign to the selected group
      if (campaign.device_group_id !== selectedGroup) {
        await supabase.from('campaigns').update({ device_group_id: selectedGroup }).eq('id', campaign.id)
      }

      // 2. Fetch all active campaigns in this group (include districts for geo-filtering)
      const { data: activeCampaigns } = await supabase
        .from('campaigns')
        .select('id, name, districts')
        .eq('status', 'active')
        .eq('device_group_id', selectedGroup)
        .order('created_at', { ascending: true })

      // Include this campaign if it's active but wasn't in the group yet
      const campaignIds = new Set((activeCampaigns || []).map(c => c.id))
      if (campaign.status === 'active' && !campaignIds.has(campaign.id)) {
        activeCampaigns?.push({ id: campaign.id, name: campaign.name, districts: campaign.districts })
      }

      interface MediaItem { url: string; type: string; duration: number; campaignName: string; campaignDistricts: string[] | null }
      const allMediaItems: MediaItem[] = []
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
            allMediaItems.push({
              url: m.file_url,
              type: m.file_type,
              duration: 10,
              campaignName: c.name,
              campaignDistricts: (c as { districts?: string[] | null }).districts || null,
            })
          }
        }
      }

      if (allMediaItems.length === 0) {
        setPushResult({ ok: false, msg: 'No approved media found in this group' })
        setPushing(false)
        return
      }

      // 3. Get online devices in this group
      const { data: groupDevices } = await supabase
        .from('devices')
        .select('id')
        .eq('group_id', selectedGroup)
      const groupDeviceIds = new Set((groupDevices || []).map((d: { id: string }) => d.id))

      const devicesRes = await fetch('/api/devices')
      const deviceList = await devicesRes.json()
      const onlineInGroup = (Array.isArray(deviceList) ? deviceList : deviceList.devices || [])
        .filter((d: { online: boolean; cardId: string }) => d.online && groupDeviceIds.has(d.cardId))

      if (onlineInGroup.length === 0) {
        setPushResult({ ok: false, msg: 'No online devices in this group' })
        setPushing(false)
        return
      }

      // 4. Push to all online devices in the group (geo-filter per device)
      const { isPointInDistrict } = await import('@/lib/districts')
      const programName = campaignNames.length === 1 ? campaignNames[0] : 'gzad playlist'
      let pushed = 0
      for (const device of onlineInGroup) {
        const devLat = (device as { last_lat?: number | null }).last_lat
        const devLng = (device as { last_lng?: number | null }).last_lng

        // Filter media: include if campaign has no district restriction, or device is in an allowed district
        const deviceItems = allMediaItems.filter(item => {
          if (!item.campaignDistricts || item.campaignDistricts.length === 0) return true
          if (!devLat || !devLng) return true // no GPS fix → show everything
          return item.campaignDistricts.some(d => isPointInDistrict(devLat, devLng, d))
        })

        if (deviceItems.length === 0) continue

        const res = await fetch('/api/devices/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cardId: device.cardId,
            action: 'push-program',
            name: programName,
            mediaItems: deviceItems,
            schedule: { startTime: '00:00', endTime: '23:59' },
            width: 240,
            height: 80,
          }),
        })
        if (res.ok) pushed++
      }

      const groupName = groups.find(g => g.id === selectedGroup)?.name || selectedGroup
      setPushResult({ ok: true, msg: `${allMediaItems.length} ad(s) from ${campaignNames.length} campaign(s) pushed to ${pushed} device(s) in "${groupName}"` })
      await load() // Refresh to show updated group assignment
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
          <button onClick={createInvoice} className="portal-btn-secondary">
            <DollarSign size={16} /> Create Invoice
          </button>
          <button onClick={() => setEditMode(!editMode)} className="portal-btn-primary">
            {editMode ? 'Cancel' : 'Edit Details'}
          </button>
        </div>
      </div>

      {/* vehhub.top helper */}
      <div style={{
        background: 'rgba(96,165,250,0.08)',
        border: '1px solid rgba(96,165,250,0.2)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px', fontWeight: 500 }}>
            Use this name in vehhub.top &quot;Ad Name&quot; field:
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#60A5FA', fontFamily: 'monospace' }}>
            {campaign.name}
          </div>
        </div>
        <button
          onClick={copyName}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(96,165,250,0.3)',
            background: copied ? 'rgba(204,243,129,0.15)' : 'rgba(96,165,250,0.1)',
            color: copied ? '#CCF381' : '#60A5FA',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            transition: 'all 0.15s',
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied!' : 'Copy Name'}
        </button>
      </div>

      {/* Push to Group */}
      <div style={{
        background: 'rgba(204,243,129,0.06)',
        border: '1px solid rgba(204,243,129,0.15)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Monitor size={18} style={{ color: '#CCF381' }} />
          <span style={{ fontWeight: 600, color: '#CCF381', fontSize: 15 }}>Push to Group</span>
          <span style={{ color: '#525252', fontSize: 12, marginLeft: 4 }}>
            ({media.filter(m => m.status === 'approved').length} approved file{media.filter(m => m.status === 'approved').length !== 1 ? 's' : ''})
          </span>
        </div>

        {groups.length === 0 ? (
          <p style={{ color: '#525252', fontSize: 13, margin: 0 }}>
            No groups created yet. Go to <Link href="/admin/groups" style={{ color: '#60A5FA' }}>Groups</Link> to create one and assign devices.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                style={{
                  background: '#0A0A0A',
                  border: '1px solid #27272a',
                  borderRadius: 8,
                  color: '#e4e4e7',
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
              <span style={{ color: '#FBBF24', fontSize: 12, display: 'block', marginTop: 10 }}>Select a group to push to</span>
            )}
            {selectedGroup && !media.some(m => m.status === 'approved') && (
              <span style={{ color: '#FBBF24', fontSize: 12, display: 'block', marginTop: 10 }}>Approve a media file first</span>
            )}
          </>
        )}

        {pushResult && (
          <div style={{
            marginTop: 10,
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
            background: pushResult.ok ? 'rgba(204,243,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: pushResult.ok ? '#CCF381' : '#EF4444',
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

      {/* Location Targeting */}
      <div className="portal-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={18} style={{ color: '#FBBF24' }} />
            <h2 style={{ margin: 0 }}>Location Targeting</h2>
          </div>
          {!districtEdit ? (
            <button
              onClick={() => setDistrictEdit(true)}
              className="portal-btn-secondary"
              style={{ padding: '6px 14px', fontSize: 13 }}
            >
              Edit
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveDistricts} className="portal-btn-primary" style={{ padding: '6px 14px', fontSize: 13 }}>
                Save
              </button>
              <button
                onClick={() => { setSelectedDistricts(campaign?.districts || []); setDistrictEdit(false) }}
                className="portal-btn-secondary"
                style={{ padding: '6px 14px', fontSize: 13 }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {!districtEdit ? (
          <div>
            {!campaign?.districts || campaign.districts.length === 0 ? (
              <span style={{ color: '#525252', fontSize: 14 }}>All Tbilisi — no district restriction</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {campaign.districts.map(d => (
                  <span key={d} style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                    background: 'rgba(251,191,36,0.1)', color: '#FBBF24',
                    border: '1px solid rgba(251,191,36,0.3)',
                  }}>
                    {d}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedDistricts.length === 0}
                  onChange={() => setSelectedDistricts([])}
                  style={{ accentColor: '#CCF381' }}
                />
                All Tbilisi (no restriction)
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
              {DISTRICT_NAMES.map(d => (
                <label key={d} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  background: selectedDistricts.includes(d) ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selectedDistricts.includes(d) ? 'rgba(251,191,36,0.4)' : '#1a1a1a'}`,
                  fontSize: 13,
                  color: selectedDistricts.includes(d) ? '#FBBF24' : '#d4d4d8',
                  transition: 'all 0.15s',
                }}>
                  <input
                    type="checkbox"
                    checked={selectedDistricts.includes(d)}
                    onChange={e => {
                      setSelectedDistricts(prev =>
                        e.target.checked ? [...prev, d] : prev.filter(x => x !== d)
                      )
                    }}
                    style={{ accentColor: '#FBBF24' }}
                  />
                  {d}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Media Upload + Review */}
      <div className="portal-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0 }}>Ad Media ({media.length})</h2>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #27272a',
              background: 'rgba(255,255,255,0.05)',
              color: '#e4e4e7',
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

        {uploadMsg && (
          <div style={{
            marginBottom: 12,
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
            background: uploadMsg.ok ? 'rgba(204,243,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: uploadMsg.ok ? '#CCF381' : '#EF4444',
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
                    color: m.status === 'approved' ? '#CCF381' : m.status === 'rejected' ? '#EF4444' : '#FBBF24',
                    borderColor: m.status === 'approved' ? '#CCF381' : m.status === 'rejected' ? '#EF4444' : '#FBBF24',
                  }}>
                    {m.status.replace('_', ' ')}
                  </span>
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
                      border: '1px solid #27272a',
                      background: 'rgba(255,255,255,0.05)',
                      color: '#d4d4d8',
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
