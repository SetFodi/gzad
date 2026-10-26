'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { ArrowLeft, Check, X, Download, Send, Monitor, Upload } from 'lucide-react'
import Link from 'next/link'
import { SLOTS_PER_DEVICE } from '@/lib/slots'
import StatusBadge from '@/components/app/StatusBadge'
import { useAdminText } from '@/lib/admin-i18n'

const CAMPAIGN_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'paused_billing', label: 'Paused — no balance' },
  { value: 'paused_cap', label: 'Paused — daily cap (resumes at midnight)' },
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
  daily_cap?: number | null
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
  const { t } = useAdminText()
  const params = useParams()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
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
    daily_cap: '',
  })
  // daily_cap arrives with migration 010; until then the field stays hidden and
  // is left out of saves.
  const [hasDailyCap, setHasDailyCap] = useState(false)
  const [spentToday, setSpentToday] = useState<number | null>(null)
  const supabase = createClient()

  async function load() {
    setLoading(true)
    setLoadError(false)
    try {
      const id = params.id as string

      const [campaignRes, mediaRes, groupsRes] = await Promise.all([
        supabase.from('campaigns').select('*, clients(company_name, id)').eq('id', id).maybeSingle(),
        supabase.from('ad_media').select('*').eq('campaign_id', id).order('uploaded_at', { ascending: false }),
        supabase.from('device_groups').select('id, name').order('name'),
      ])

      const failedRead = [campaignRes, mediaRes, groupsRes].find(result => result.error)
      if (failedRead) throw failedRead.error

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
          daily_cap: campaignRes.data.daily_cap != null ? String(campaignRes.data.daily_cap) : '',
        })
        setHasDailyCap('daily_cap' in campaignRes.data)
      }
      if (campaignRes.data && 'daily_cap' in campaignRes.data) {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' })
        const { data: spend, error: spendError } = await supabase
          .from('billing_daily_totals')
          .select('total_cost')
          .eq('campaign_id', id)
          .eq('day', today)
        if (spendError) throw spendError
        setSpentToday((spend || []).reduce((sum, r) => sum + Number(r.total_cost), 0))
      }
      setMedia(mediaRes.data || [])
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
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
        setPushResult({ ok: false, msg: result.error || t('Sync failed') })
        return
      }
      if (result.groups === 0) {
        setPushResult({ ok: false, msg: t('{label} saved. Assign a device group to put it on air.', { label }) })
        return
      }
      const overflow = result.overflow
        ? ' ' + t('{n} campaign(s) had no free slot.', { n: result.overflow })
        : ''
      setPushResult({
        ok: true,
        msg: t('{label} saved. {media} item(s) pushed to {synced}/{devices} device(s).', { label, media: result.media, synced: result.synced, devices: result.devices }) + overflow,
      })
    } catch {
      setPushResult({ ok: false, msg: t('{label} saved, but the Realtime Server is unreachable', { label }) })
    } finally {
      setSyncing(false)
    }
  }

  const updateMedia = async (mediaId: string, status: string) => {
    await supabase.from('ad_media').update({ status }).eq('id', mediaId)
    await load()
    await resync(status === 'approved' ? t('Approval') : t('Change'))
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
    await resync(t('Approval'))
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
    await resync(t('Duration'))
  }

  const saveCampaign = async () => {
    const { daily_cap, ...rest } = form
    const cap = daily_cap.trim() === '' ? null : Number(daily_cap)
    if (cap !== null && !(cap > 0)) {
      alert(t('Daily cap must be a positive amount, or empty for no cap.'))
      return
    }
    await supabase
      .from('campaigns')
      .update(hasDailyCap ? { ...rest, daily_cap: cap } : rest)
      .eq('id', params.id as string)
    setEditMode(false)
    await load()
    await resync(t('Campaign'))
  }

  const updateStatus = async (status: string) => {
    await supabase.from('campaigns').update({ status }).eq('id', params.id as string)
    await load()
    await resync(t('Status'))
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
        setPushResult({ ok: false, msg: result.error || t('Push failed') })
        return
      }

      const groupName = groups.find(g => g.id === selectedGroup)?.name || selectedGroup
      if (result.media === 0) {
        setPushResult({
          ok: false,
          msg: t('No live campaigns with approved media in "{group}". The screens were cleared.', { group: groupName }),
        })
        return
      }

      const overflow = result.overflow
        ? ' ' + t('{n} campaign(s) exceeded the {slots} slots available.', { n: result.overflow, slots: SLOTS_PER_DEVICE })
        : ''
      setPushResult({
        ok: true,
        msg: t('{media} item(s) pushed to {synced}/{devices} device(s) in "{group}".', { media: result.media, synced: result.synced, devices: result.devices, group: groupName }) + overflow,
      })
      await load()
    } catch {
      setPushResult({ ok: false, msg: t('Cannot reach the Realtime Server') })
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
      setUploadMsg({ ok: true, msg: t('{n} file(s) uploaded and approved', { n: files.length }) })
      await load()
    } catch (err) {
      setUploadMsg({ ok: false, msg: err instanceof Error ? err.message : t('Upload failed') })
    } finally {
      setUploadingMedia(false)
      // Reset the input so same file can be re-uploaded
      e.target.value = ''
    }
  }

  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>{t('Could not load this page from the database. Please try again.')}</p>
        <button type="button" className="portal-btn-primary" onClick={() => void load()}>{t('Try again')}</button>
      </div>
    </div>
  )

  if (loading) return <div className="portal-loading">{t('Loading…')}</div>
  if (!campaign) return <div className="portal-loading">{t('Campaign not found')}</div>

  return (
    <div className="portal-page">
      <Link href="/admin/campaigns" className="portal-back-link">
        <ArrowLeft size={16} /> {t('Campaigns')}
      </Link>

      <div className="portal-page-header">
        <div>
          <div className="title-row">
            <h1 className="portal-page-title">{campaign.name}</h1>
            <StatusBadge status={campaign.status} />
          </div>
          <p className="portal-subtitle">{campaign.clients?.company_name || t('No client')}</p>
        </div>
        <div className="admin-header-actions">
          <select
            value={campaign.status}
            onChange={(e) => updateStatus(e.target.value)}
            disabled={syncing}
            title={t("Changing status re-pushes the playlist to this campaign's devices")}
            aria-label={t('Status')}
            style={{ width: 'auto', minHeight: 38 }}
          >
            {CAMPAIGN_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{t(s.label)}</option>
            ))}
          </select>
          <button type="button" onClick={() => setEditMode(!editMode)} className="portal-btn-secondary">
            {editMode ? t('Cancel') : t('Edit details')}
          </button>
        </div>
      </div>

      <section className="push-card">
        <div className="push-card-text">
          <h2><Monitor size={17} aria-hidden /> {t('Push to screens')}</h2>
          <p className="cell-sub">
            {t('Sends the {n} approved file(s) to every online screen in a group.', { n: media.filter(m => m.status === 'approved').length })}
          </p>
        </div>
        {groups.length === 0 ? (
          <p className="cell-sub" style={{ margin: 0 }}>
            {t('No groups yet.')} <Link href="/admin/groups" className="section-link">{t('Create one')}</Link> {t('and assign screens first.')}
          </p>
        ) : (
          <div className="push-card-controls">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              aria-label={t('Group')}
              style={{ width: 'auto', minWidth: 200, minHeight: 38 }}
            >
              <option value="">{t('Select a group…')}</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={pushToGroup}
              disabled={pushing || !selectedGroup || !media.some(m => m.status === 'approved')}
              className="portal-btn-primary"
              title={!selectedGroup ? t('Select a group first') : !media.some(m => m.status === 'approved') ? t('Approve a media file first') : undefined}
            >
              <Send size={16} aria-hidden />
              {pushing ? t('Pushing…') : t('Push')}
            </button>
          </div>
        )}
        {selectedGroup && !media.some(m => m.status === 'approved') && (
          <p className="cell-sub" style={{ margin: 0, color: 'var(--portal-warning)' }}>{t('Approve a media file first.')}</p>
        )}
        {pushResult && (
          <div className={`portal-alert ${pushResult.ok ? 'portal-alert-success' : 'portal-alert-danger'}`} role="status" style={{ margin: 0, flexBasis: '100%' }}>
            {pushResult.msg}
          </div>
        )}
      </section>

      {editMode ? (
        <div className="portal-section push-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
          <h2>{t('Campaign details')}</h2>
          <div className="admin-edit-form">
            <div className="admin-form-row">
              <div className="portal-input-group">
                <label>{t('Start date')}</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="portal-input-group">
                <label>{t('End date')}</label>
                <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="admin-form-row">
              <div className="portal-input-group">
                <label>{t('Hours a day')}</label>
                <input type="number" value={form.daily_hours} onChange={(e) => setForm({ ...form, daily_hours: parseInt(e.target.value) })} min={1} max={24} />
              </div>
              <div className="portal-input-group">
                <label>{t('Number of taxis')}</label>
                <input type="number" value={form.taxi_count} onChange={(e) => setForm({ ...form, taxi_count: parseInt(e.target.value) })} min={1} />
              </div>
              <div className="portal-input-group">
                <label>{t('Monthly price (₾)')}</label>
                <input type="number" value={form.monthly_price} onChange={(e) => setForm({ ...form, monthly_price: parseFloat(e.target.value) })} min={0} />
              </div>
              {hasDailyCap && (
                <div className="portal-input-group">
                  <label>{t('Daily cap (₾)')}</label>
                  <input
                    type="number"
                    value={form.daily_cap}
                    placeholder={t('No cap')}
                    onChange={(e) => setForm({ ...form, daily_cap: e.target.value })}
                    min={0.01}
                    step={0.01}
                  />
                </div>
              )}
            </div>
            <div><button type="button" onClick={saveCampaign} className="portal-btn-primary">{t('Save changes')}</button></div>
          </div>
        </div>
      ) : (
        <dl className="detail-grid">
          <div>
            <dt>{t('Dates')}</dt>
            <dd>{campaign.start_date || campaign.end_date ? `${campaign.start_date || '…'} → ${campaign.end_date || '…'}` : t('No end date')}</dd>
          </div>
          <div>
            <dt>{t('Coverage')}</dt>
            <dd>{t('{hours} h a day on {taxis} taxi(s)', { hours: campaign.daily_hours, taxis: campaign.taxi_count })}</dd>
          </div>
          <div>
            <dt>{t('Monthly price')}</dt>
            <dd>{campaign.monthly_price ? `₾${campaign.monthly_price}` : '—'}</dd>
          </div>
          {hasDailyCap && (
            <div>
              <dt>{t('Daily cap')}</dt>
              <dd>
                {campaign.daily_cap ? `₾${Number(campaign.daily_cap).toFixed(2)}` : t('No cap')}
                {spentToday !== null && <span className="cell-sub"> · {t('₾{amount} spent today', { amount: spentToday.toFixed(2) })}</span>}
              </dd>
            </div>
          )}
          <div>
            <dt>{t('Group')}</dt>
            <dd>{groups.find(g => g.id === campaign.device_group_id)?.name || t('All screens')}</dd>
          </div>
        </dl>
      )}

      {/* Media Upload + Review */}
      <div className="portal-section">
        <div className="section-head">
          <h2>{t('Media')} <span className="cell-sub">{media.length}</span></h2>
          <div className="admin-header-actions">
            {media.some(m => m.status === 'pending_review') && (
              <button type="button" onClick={approveAllMedia} className="portal-btn-primary">
                <Check size={16} aria-hidden />
                {t('Approve all ({count})', { count: media.filter(m => m.status === 'pending_review').length })}
              </button>
            )}
            <label className="portal-btn-secondary" aria-disabled={uploadingMedia || undefined} style={{ cursor: uploadingMedia ? 'wait' : 'pointer' }}>
              <Upload size={16} aria-hidden />
              {uploadingMedia ? t('Uploading…') : t('Upload media')}
              <input
                type="file"
                multiple
                accept="image/*,video/mp4"
                onChange={handleAdminUpload}
                disabled={uploadingMedia}
                className="file-input"
              />
            </label>
          </div>
        </div>

        {uploadMsg && (
          <div className={`portal-alert ${uploadMsg.ok ? 'portal-alert-success' : 'portal-alert-danger'}`} role="status" style={{ margin: 0 }}>
            {uploadMsg.msg}
          </div>
        )}

        {media.length === 0 ? (
          <div className="portal-empty portal-empty-sm"><p>{t("No media yet. Upload the client's files with the button above.")}</p></div>
        ) : (
          <div className="admin-media-review">
            {media.map((m) => (
              <div key={m.id} className="admin-media-card">
                <div className="admin-media-preview">
                  {m.file_type.startsWith('image') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.file_url} alt={m.file_name} />
                  ) : (
                    <video src={m.file_url} controls />
                  )}
                </div>
                <div className="admin-media-info">
                  <span className="admin-media-name">{m.file_name}</span>
                  <StatusBadge status={m.status} />
                </div>
                <div className="admin-media-actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div className="segmented" role="group" aria-label={t('Duration on screen')}>
                    {[10, 20, 30].map(sec => (
                      <button
                        key={sec}
                        type="button"
                        aria-pressed={(m.display_duration_seconds || 10) === sec}
                        onClick={() => updateMediaDuration(m.id, sec)}
                      >
                        {sec} s
                      </button>
                    ))}
                  </div>
                  <div className="device-actions">
                    {m.status === 'pending_review' && (
                      <>
                        <button type="button" className="action-btn approve" onClick={() => updateMedia(m.id, 'approved')}>
                          <Check size={14} aria-hidden /> {t('Approve')}
                        </button>
                        <button type="button" className="action-btn reject" onClick={() => updateMedia(m.id, 'rejected')}>
                          <X size={14} aria-hidden /> {t('Reject')}
                        </button>
                      </>
                    )}
                    <button type="button" className="action-btn" onClick={() => downloadFile(m.file_url, m.file_name)} style={{ marginLeft: 'auto' }}>
                      <Download size={14} aria-hidden /> {t('Download')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
