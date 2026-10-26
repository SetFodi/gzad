'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, X, Trash2, Search } from 'lucide-react'
import StatusBadge from '@/components/app/StatusBadge'
import AppDialog from '@/components/app/AppDialog'
import { useAdminText } from '@/lib/admin-i18n'

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
  device_groups: { name: string } | null
  media_count?: number
  pending_media?: number
  first_media_url?: string
  first_media_type?: string
}

interface ClientOption {
  id: string
  company_name: string
}

const NAME_REGEX = /^[a-z0-9][a-z0-9 ]*[a-z0-9]$|^[a-z0-9]$/

const FILTERS = ['all', 'pending_review', 'active', 'paused', 'paused_billing', 'paused_cap', 'completed'] as const
const FILTER_LABELS: Record<string, string> = {
  all: 'All',
  pending_review: 'Pending review',
  active: 'Active',
  paused: 'Paused',
  paused_billing: 'Out of balance',
  paused_cap: 'Daily cap',
  completed: 'Completed',
}

// The overview links here with ?status=…; the first render is the loading
// state on server and client alike, so reading the URL here can't mismatch.
function initialFilter() {
  if (typeof window === 'undefined') return 'all'
  const status = new URLSearchParams(window.location.search).get('status')
  return status && (FILTERS as readonly string[]).includes(status) ? status : 'all'
}

export default function AdminCampaignsPage() {
  const { t } = useAdminText()
  const [campaigns, setCampaigns] = useState<CampaignWithClient[]>([])
  const [filter, setFilter] = useState<string>(initialFilter)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [newCampaign, setNewCampaign] = useState({ name: '', client_id: '' })
  const supabase = createClient()

  async function loadClients() {
    const { data, error } = await supabase.from('clients').select('id, company_name').order('company_name')
    if (error) throw error
    setClients(data || [])
  }

  const createCampaign = async () => {
    const name = newCampaign.name.trim()
    if (!name || !NAME_REGEX.test(name)) {
      setCreateError(t('Only lowercase English letters, numbers, and spaces allowed'))
      return
    }
    if (!newCampaign.client_id) {
      setCreateError(t('Select a client'))
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
        setCreateError(t('A campaign with this name already exists'))
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
      setCreateError(t('Failed to create campaign'))
    } finally {
      setCreating(false)
    }
  }

  async function loadCampaigns() {
    setLoading(true)
    setLoadError(false)
    try {
      await loadClients()
      const { data, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*, clients(company_name), device_groups(name)')
        .order('created_at', { ascending: false })

      if (campaignsError) throw campaignsError
      if (data) {
        const ids = data.map(c => c.id)
        const { data: mediaRows, error: mediaError } = ids.length
          ? await supabase
            .from('ad_media')
            .select('campaign_id, status, file_url, file_type')
            .in('campaign_id', ids)
            .order('uploaded_at', { ascending: true })
          : { data: [], error: null }

        if (mediaError) throw mediaError
        const media = new Map<string, { count: number; pending: number; url?: string; type?: string }>()
        for (const m of mediaRows || []) {
          const entry = media.get(m.campaign_id) ?? { count: 0, pending: 0 }
          if (entry.count === 0) { entry.url = m.file_url; entry.type = m.file_type }
          entry.count++
          if (m.status === 'pending_review') entry.pending++
          media.set(m.campaign_id, entry)
        }

        setCampaigns(data.map(c => {
          const m = media.get(c.id)
          return {
            ...c,
            media_count: m?.count ?? 0,
            pending_media: m?.pending ?? 0,
            first_media_url: m?.url,
            first_media_type: m?.type,
          }
        }))
      }
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCampaigns() }, [])

  const updateStatus = async (campaignId: string, newStatus: string) => {
    const campaign = campaigns.find(c => c.id === campaignId)
    await supabase.from('campaigns').update({ status: newStatus }).eq('id', campaignId)

    // When approving a campaign, auto-approve all pending media
    if (newStatus === 'active') {
      await supabase
        .from('ad_media')
        .update({ status: 'approved' })
        .eq('campaign_id', campaignId)
        .eq('status', 'pending_review')
    }

    // Re-sync group when rotation changes (resume/pause/complete)
    if (newStatus === 'active' || newStatus === 'paused' || newStatus === 'completed') {
      await syncGroupDevices(campaign?.device_group_id || null)
    }
    await loadCampaigns()
  }

  const deleteCampaign = async (campaignId: string, campaignName: string) => {
    if (!confirm(t('Delete campaign "{name}"? This will also delete all its media files. This cannot be undone.', { name: campaignName }))) return

    const campaign = campaigns.find(c => c.id === campaignId)
    const groupId = campaign?.device_group_id || null

    await supabase.from('ad_media').delete().eq('campaign_id', campaignId)
    await supabase.from('campaigns').delete().eq('id', campaignId)
    await syncGroupDevices(groupId)
    await loadCampaigns()
  }

  const syncGroupDevices = async (groupId: string | null) => {
    if (!groupId) return // Only sync grouped campaigns
    try {
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
          .select('file_url, file_type, display_duration_seconds')
          .eq('campaign_id', c.id)
          .eq('status', 'approved')
        if (approved && approved.length > 0) {
          campaignNames.push(c.name)
          for (const m of approved) {
            mediaItems.push({ url: m.file_url, type: m.file_type, duration: m.display_duration_seconds || 10, campaignName: c.name })
          }
        }
      }

      const { data: groupDevices } = await supabase.from('devices').select('id').eq('group_id', groupId)
      const groupIds = new Set((groupDevices || []).map((d: { id: string }) => d.id))

      const devicesRes = await fetch('/api/devices')
      const deviceList = await devicesRes.json()
      const onlineDevices = (Array.isArray(deviceList) ? deviceList : deviceList.devices || [])
        .filter((d: { online: boolean; cardId: string }) => d.online && groupIds.has(d.cardId))

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
              cardId: device.cardId, action: 'push-program',
              name: campaignNames.length === 1 ? campaignNames[0] : 'gzad playlist',
              mediaItems, schedule: { startTime: '00:00', endTime: '23:59' },
              width: 240, height: 80,
            }),
          })
        }
      }
    } catch (err) {
      console.error('Failed to sync devices:', err)
    }
  }

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = { all: campaigns.length }
    for (const c of campaigns) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1
    return byStatus
  }, [campaigns])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return campaigns.filter(c =>
      (filter === 'all' || c.status === filter) &&
      (!q || c.name.toLowerCase().includes(q) || (c.clients?.company_name ?? '').toLowerCase().includes(q)),
    )
  }, [campaigns, filter, query])

  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>{t('Could not load this page from the database. Please try again.')}</p>
        <button type="button" className="portal-btn-primary" onClick={() => void loadCampaigns()}>{t('Try again')}</button>
      </div>
    </div>
  )

  if (loading) return <div className="portal-loading">{t('Loading…')}</div>

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{t('Campaigns')}</h1>
          <p className="portal-subtitle">{t('Review new ads, and pause, resume or remove campaigns.')}</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowCreate(true); setCreateError('') }}
          className="portal-btn-primary"
        >
          <Plus size={16} aria-hidden />
          {t('New campaign')}
        </button>
      </div>

      {showCreate && (
        <AppDialog labelledBy="new-campaign-title" onClose={() => setShowCreate(false)}>
            <div className="admin-modal-header">
              <h2 id="new-campaign-title">{t('New campaign')}</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="admin-modal-close" aria-label={t('Close')}><X size={20} /></button>
            </div>
            <form
              className="portal-form"
              onSubmit={(e) => { e.preventDefault(); createCampaign() }}
            >
              {createError && <div className="portal-login-error" role="alert">{createError}</div>}
              <div className="portal-input-group">
                <label htmlFor="new-campaign-name">{t('Name')}</label>
                <input
                  id="new-campaign-name"
                  type="text"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value.toLowerCase().replace(/[^a-z0-9 ]/g, '') })}
                  placeholder={t('e.g. summer sale promo')}
                  autoFocus
                />
                <span className="field-hint">{t('Lowercase English letters, numbers and spaces. Play logs match campaigns by this name.')}</span>
              </div>
              <div className="portal-input-group">
                <label htmlFor="new-campaign-client">{t('Client')}</label>
                <select
                  id="new-campaign-client"
                  value={newCampaign.client_id}
                  onChange={(e) => setNewCampaign({ ...newCampaign, client_id: e.target.value })}
                >
                  <option value="">{t('Select a client…')}</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>
              <span className="field-hint">{t('Campaigns created here start as Active.')}</span>
              <button type="submit" disabled={creating} className="portal-btn-primary full-width">
                {creating ? t('Creating…') : t('Create campaign')}
              </button>
            </form>
        </AppDialog>
      )}

      <div className="table-toolbar">
        <div className="admin-filters" role="tablist" aria-label={t('Status')}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={`admin-filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {t(FILTER_LABELS[f])}
              <span className="filter-count">{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search campaigns or clients')}
            aria-label={t('Search campaigns or clients')}
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="portal-empty">
          <p>{campaigns.length === 0 ? t('No campaigns yet.') : t('No campaigns match this view.')}</p>
        </div>
      ) : (
        <div className="campaigns-table-wrapper">
          <table className="portal-table">
            <thead>
              <tr>
                <th>{t('Campaign')}</th>
                <th>{t('Status')}</th>
                <th>{t('Group')}</th>
                <th>{t('Media')}</th>
                <th>{t('Dates')}</th>
                <th>{t('Price')}</th>
                <th aria-label={t('Actions')} />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="cell-media">
                      <div className="cell-thumb">
                        {c.first_media_url && (
                          c.first_media_type?.startsWith('video') ? (
                            <video src={c.first_media_url} muted playsInline preload="metadata" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.first_media_url} alt="" loading="lazy" />
                          )
                        )}
                      </div>
                      <div className="cell-stack">
                        <Link href={`/admin/campaigns/${c.id}`} className="table-link">{c.name}</Link>
                        <span className="cell-sub">{c.clients?.company_name || t('No client')}</span>
                      </div>
                    </div>
                  </td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>
                    {c.device_groups?.name
                      ? <span className="portal-chip">{c.device_groups.name}</span>
                      : <span className="cell-sub">—</span>}
                  </td>
                  <td>
                    <div className="cell-stack">
                      <span>{c.media_count}</span>
                      {c.pending_media! > 0 && <span className="cell-sub" style={{ color: 'var(--portal-warning)' }}>{t('{n} to review', { n: c.pending_media ?? 0 })}</span>}
                    </div>
                  </td>
                  <td className="cell-nowrap">{c.start_date || c.end_date ? `${c.start_date || '…'} → ${c.end_date || '…'}` : <span className="cell-sub">{t('No end date')}</span>}</td>
                  <td className="cell-nowrap">{c.monthly_price ? t('₾{amount}/mo', { amount: c.monthly_price }) : '—'}</td>
                  <td>
                    <div className="admin-actions" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                      {c.status === 'pending_review' && (
                        <>
                          <button type="button" className="action-btn approve" onClick={() => updateStatus(c.id, 'active')}>{t('Approve')}</button>
                          <button type="button" className="action-btn reject" onClick={() => updateStatus(c.id, 'paused')}>{t('Reject')}</button>
                        </>
                      )}
                      {c.status === 'active' && (
                        <button type="button" className="action-btn" onClick={() => updateStatus(c.id, 'paused')}>{t('Pause')}</button>
                      )}
                      {(c.status === 'paused' || c.status === 'paused_billing' || c.status === 'paused_cap') && (
                        <button type="button" className="action-btn approve" onClick={() => updateStatus(c.id, 'active')}>{t('Resume')}</button>
                      )}
                      <button
                        type="button"
                        className="app-icon-btn danger"
                        onClick={() => deleteCampaign(c.id, c.name)}
                        aria-label={t('Delete {name}', { name: c.name })}
                        title={t('Delete')}
                      >
                        <Trash2 size={16} aria-hidden />
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
