'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { ArrowLeft, Check, X, DollarSign, Copy, Download, Send, Monitor } from 'lucide-react'
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
  clients: { company_name: string; id: string } | null
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

    const { data: campaignData } = await supabase
      .from('campaigns')
      .select('*, clients(company_name, id)')
      .eq('id', id)
      .single()

    const { data: mediaData } = await supabase
      .from('ad_media')
      .select('*')
      .eq('campaign_id', id)
      .order('uploaded_at', { ascending: false })

    setCampaign(campaignData)
    if (campaignData) {
      setForm({
        start_date: campaignData.start_date || '',
        end_date: campaignData.end_date || '',
        daily_hours: campaignData.daily_hours,
        taxi_count: campaignData.taxi_count,
        monthly_price: campaignData.monthly_price || 0,
      })
    }
    setMedia(mediaData || [])
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
      const onlineDevices = list.filter((d: Device) => d.online)
      setDevices(onlineDevices)
      if (onlineDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(onlineDevices[0].cardId)
      }
    } catch {
      // Realtime Server not running — that's ok
    }
  }, [selectedDevice])

  useEffect(() => { loadDevices() }, [loadDevices])

  const pushToDevice = async () => {
    if (!campaign || !selectedDevice) return
    // Find the first approved media file
    const approvedMedia = media.find(m => m.status === 'approved')
    if (!approvedMedia) {
      setPushResult({ ok: false, msg: 'No approved media to push. Approve a media file first.' })
      return
    }

    setPushing(true)
    setPushResult(null)
    try {
      const res = await fetch('/api/devices/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: selectedDevice,
          action: 'push-program',
          name: campaign.name,
          duration: 10,
          mediaUrl: approvedMedia.file_url,
          mediaType: approvedMedia.file_type,
          width: 960,
          height: 320,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setPushResult({ ok: true, msg: `"${campaign.name}" pushed to ${selectedDevice}` })
      } else {
        setPushResult({ ok: false, msg: data.error || 'Push failed' })
      }
    } catch {
      setPushResult({ ok: false, msg: 'Cannot reach Realtime Server' })
    } finally {
      setPushing(false)
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
        </div>

        {devices.length === 0 ? (
          <p style={{ color: '#525252', fontSize: 13, margin: 0 }}>
            No devices online. Connect a device via the Realtime Server first.
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
              {pushing ? 'Pushing...' : 'Push Ad'}
            </button>
            {!media.some(m => m.status === 'approved') && (
              <span style={{ color: '#FBBF24', fontSize: 12 }}>Approve a media file first</span>
            )}
          </div>
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
        </div>
      )}

      {/* Media Review */}
      <div className="portal-section">
        <h2>Ad Media ({media.length})</h2>
        {media.length === 0 ? (
          <p className="portal-empty-text">No media uploaded yet.</p>
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
