'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { ArrowLeft, Check, X, DollarSign, Copy, Download, Send, Monitor, Upload, Trash2, Play } from 'lucide-react'
import Link from 'next/link'

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
}

interface Device {
  cardId: string
  online: boolean
}

export default function AdminCampaignDetailPage() {
  const params = useParams()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [copied, setCopied] = useState(false)
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDevice, setSelectedDevice] = useState('')
  const [pushing, setPushing] = useState(false)
  const [pushResult, setPushResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [clearing, setClearing] = useState(false)
  const [checkingPlaying, setCheckingPlaying] = useState(false)
  const [playingInfo, setPlayingInfo] = useState<string | null>(null)
  const [groups, setGroups] = useState<DeviceGroup[]>([])
  const [schedule, setSchedule] = useState({
    startTime: '00:00',
    endTime: '23:59',
    days: [0, 1, 2, 3, 4, 5, 6] as number[],
  })
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

  const loadDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/devices')
      const data = await res.json()
      const list = Array.isArray(data) ? data : data.devices || []
      let onlineDevices = list.filter((d: Device) => d.online)

      // If campaign has a group, filter to only devices in that group
      if (campaign?.device_group_id) {
        const { data: groupDevices } = await supabase
          .from('devices')
          .select('id')
          .eq('group_id', campaign.device_group_id)
        const groupIds = new Set((groupDevices || []).map((d: { id: string }) => d.id))
        onlineDevices = onlineDevices.filter((d: Device) => groupIds.has(d.cardId))
      }

      setDevices(onlineDevices)
      if (onlineDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(onlineDevices[0].cardId)
      }
    } catch {
      // Realtime Server not running — that's ok
    }
  }, [selectedDevice, campaign?.device_group_id])

  useEffect(() => { loadDevices() }, [loadDevices])

  const pushToDevice = async () => {
    if (!campaign || !selectedDevice) return

    setPushing(true)
    setPushResult(null)
    try {
      // Fetch active campaigns in the same group (or all if no group) and combine their approved media
      let query = supabase
        .from('campaigns')
        .select('id, name')
        .eq('status', 'active')
        .order('created_at', { ascending: true })

      if (campaign.device_group_id) {
        query = query.eq('device_group_id', campaign.device_group_id)
      }

      const { data: activeCampaigns } = await query

      if (!activeCampaigns || activeCampaigns.length === 0) {
        setPushResult({ ok: false, msg: 'No active campaigns found' })
        setPushing(false)
        return
      }

      const allMediaItems: { url: string; type: string; duration: number }[] = []
      const campaignNames: string[] = []

      for (const c of activeCampaigns) {
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
              duration: m.file_type.startsWith('video') ? 0 : 10,
            })
          }
        }
      }

      if (allMediaItems.length === 0) {
        setPushResult({ ok: false, msg: 'No approved media in any active campaign' })
        setPushing(false)
        return
      }

      const scheduleConfig: Record<string, unknown> = {
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      }
      if (schedule.days.length < 7) {
        scheduleConfig.days = schedule.days
      }
      if (campaign.start_date) scheduleConfig.startDate = campaign.start_date
      if (campaign.end_date) scheduleConfig.endDate = campaign.end_date

      // Use combined name so all campaigns are in one program
      const programName = campaignNames.length === 1 ? campaignNames[0] : 'gzad playlist'

      const res = await fetch('/api/devices/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: selectedDevice,
          action: 'push-program',
          name: programName,
          mediaItems: allMediaItems,
          schedule: scheduleConfig,
          width: 960,
          height: 320,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setPushResult({ ok: true, msg: `${allMediaItems.length} file(s) from ${campaignNames.length} campaign(s) pushed to ${selectedDevice}` })
      } else {
        setPushResult({ ok: false, msg: data.error || 'Push failed' })
      }
    } catch {
      setPushResult({ ok: false, msg: 'Cannot reach Realtime Server' })
    } finally {
      setPushing(false)
    }
  }

  const clearDisplay = async () => {
    if (!selectedDevice) return
    setClearing(true)
    setPushResult(null)
    try {
      const res = await fetch('/api/devices/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: selectedDevice, action: 'clear-program' }),
      })
      const data = await res.json()
      setPushResult({ ok: res.ok, msg: res.ok ? 'Display cleared' : (data.error || 'Failed to clear') })
    } catch {
      setPushResult({ ok: false, msg: 'Cannot reach Realtime Server' })
    } finally {
      setClearing(false)
    }
  }

  const checkPlaying = async () => {
    if (!selectedDevice) return
    setCheckingPlaying(true)
    setPlayingInfo(null)
    try {
      const res = await fetch('/api/devices/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: selectedDevice, action: 'get-playing' }),
      })
      const data = await res.json()
      if (res.ok && data.result) {
        const result = typeof data.result === 'string' ? JSON.parse(data.result) : data.result
        setPlayingInfo(result.name || result.programName || JSON.stringify(result))
      } else {
        setPlayingInfo(data.error || 'No program playing')
      }
    } catch {
      setPlayingInfo('Cannot reach Realtime Server')
    } finally {
      setCheckingPlaying(false)
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

      {/* Push to Display */}
      <div style={{
        background: 'rgba(204,243,129,0.06)',
        border: '1px solid rgba(204,243,129,0.15)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Monitor size={18} style={{ color: '#CCF381' }} />
          <span style={{ fontWeight: 600, color: '#CCF381', fontSize: 15 }}>Push to Display</span>
          <span style={{ color: '#525252', fontSize: 12, marginLeft: 4 }}>
            ({media.filter(m => m.status === 'approved').length} approved file{media.filter(m => m.status === 'approved').length !== 1 ? 's' : ''})
          </span>
          {campaign.device_group_id && (
            <span style={{
              fontSize: 11, color: '#60A5FA', background: 'rgba(96,165,250,0.1)',
              border: '1px solid rgba(96,165,250,0.2)', borderRadius: 6,
              padding: '2px 8px', marginLeft: 4,
            }}>
              Group: {groups.find(g => g.id === campaign.device_group_id)?.name}
            </span>
          )}
        </div>

        {devices.length === 0 ? (
          <p style={{ color: '#525252', fontSize: 13, margin: 0 }}>
            No devices online. Connect a device via the Realtime Server first.
          </p>
        ) : (
          <>
            {/* Device selector + action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                style={{
                  background: '#0A0A0A',
                  border: '1px solid #27272a',
                  borderRadius: 8,
                  color: '#e4e4e7',
                  padding: '8px 12px',
                  fontSize: 14,
                }}
              >
                {devices.map(d => (
                  <option key={d.cardId} value={d.cardId}>{d.cardId}</option>
                ))}
              </select>
              <button
                onClick={pushToDevice}
                disabled={pushing || !media.some(m => m.status === 'approved')}
                className="portal-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: pushing ? 0.6 : 1 }}
              >
                <Send size={16} />
                {pushing ? 'Pushing...' : 'Push All Approved'}
              </button>
              <button
                onClick={clearDisplay}
                disabled={clearing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8,
                  border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
                  color: '#EF4444', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                  opacity: clearing ? 0.6 : 1,
                }}
              >
                <Trash2 size={16} />
                {clearing ? 'Clearing...' : 'Clear Display'}
              </button>
              <button
                onClick={checkPlaying}
                disabled={checkingPlaying}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8,
                  border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.1)',
                  color: '#60A5FA', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                  opacity: checkingPlaying ? 0.6 : 1,
                }}
              >
                <Play size={16} />
                {checkingPlaying ? 'Checking...' : 'Check Playing'}
              </button>
            </div>

            {/* Schedule config */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid #1a1a1a',
              borderRadius: 8,
              padding: '12px 16px',
            }}>
              <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10, fontWeight: 500 }}>Schedule</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ color: '#a1a1aa', fontSize: 13 }}>From</label>
                  <input
                    type="time"
                    value={schedule.startTime}
                    onChange={(e) => setSchedule({ ...schedule, startTime: e.target.value })}
                    style={{
                      background: '#0A0A0A', border: '1px solid #27272a', borderRadius: 6,
                      color: '#e4e4e7', padding: '6px 10px', fontSize: 13,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ color: '#a1a1aa', fontSize: 13 }}>To</label>
                  <input
                    type="time"
                    value={schedule.endTime}
                    onChange={(e) => setSchedule({ ...schedule, endTime: e.target.value })}
                    style={{
                      background: '#0A0A0A', border: '1px solid #27272a', borderRadius: 6,
                      color: '#e4e4e7', padding: '6px 10px', fontSize: 13,
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                  <button
                    key={day}
                    onClick={() => {
                      const days = schedule.days.includes(i)
                        ? schedule.days.filter(d => d !== i)
                        : [...schedule.days, i].sort()
                      setSchedule({ ...schedule, days })
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                      border: '1px solid',
                      borderColor: schedule.days.includes(i) ? 'rgba(204,243,129,0.4)' : '#27272a',
                      background: schedule.days.includes(i) ? 'rgba(204,243,129,0.15)' : 'transparent',
                      color: schedule.days.includes(i) ? '#CCF381' : '#71717a',
                      cursor: 'pointer',
                    }}
                  >
                    {day}
                  </button>
                ))}
              </div>
              {campaign.start_date && campaign.end_date && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#525252' }}>
                  Date range: {campaign.start_date} to {campaign.end_date} (from campaign settings)
                </div>
              )}
            </div>

            {!media.some(m => m.status === 'approved') && (
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

        {playingInfo && (
          <div style={{
            marginTop: 10,
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
            background: 'rgba(96,165,250,0.1)',
            color: '#60A5FA',
          }}>
            Now playing: {playingInfo}
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
            <div className="admin-form-row">
              <div className="portal-input-group">
                <label>Device Group</label>
                <select
                  value={campaign.device_group_id || ''}
                  onChange={async (e) => {
                    const val = e.target.value || null
                    await supabase.from('campaigns').update({ device_group_id: val }).eq('id', campaign.id)
                    await load()
                  }}
                  style={{ background: '#0A0A0A', border: '1px solid #27272a', borderRadius: 8, color: '#e4e4e7', padding: '8px 12px', fontSize: 14, width: '100%' }}
                >
                  <option value="">All devices (no group filter)</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
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
