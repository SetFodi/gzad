'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, CheckCircle } from 'lucide-react'

interface Campaign {
  id: string
  name: string
  clients: { company_name: string } | null
}

export default function AdminStatsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState('')
  const [csvData, setCsvData] = useState('')
  const [vehhubData, setVehhubData] = useState('')
  const [manualEntry, setManualEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    play_count: 0,
    total_duration_seconds: 0,
    unique_taxis: 0,
    km_covered: 0,
  })
  const [mode, setMode] = useState<'manual' | 'csv' | 'vehhub'>('vehhub')
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('campaigns')
        .select('id, name, clients(company_name)')
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false })

      setCampaigns((data || []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        name: c.name as string,
        clients: c.clients as { company_name: string } | null,
      })))
      setLoading(false)
    }
    load()
  }, [])

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCampaign) { setError('Select a campaign'); return }

    setUploading(true)
    setError('')
    setSuccess('')

    const { error: insertError } = await supabase.from('play_stats').insert({
      campaign_id: selectedCampaign,
      ...manualEntry,
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setSuccess('Stats added successfully')
      setManualEntry({ ...manualEntry, play_count: 0, total_duration_seconds: 0, unique_taxis: 0, km_covered: 0 })
    }
    setUploading(false)
  }

  const handleCsvUpload = async () => {
    if (!selectedCampaign || !csvData.trim()) {
      setError('Select a campaign and paste CSV data')
      return
    }

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const lines = csvData.trim().split('\n')
      const header = lines[0].toLowerCase()
      const hasHeader = header.includes('date') || header.includes('play')

      const rows = (hasHeader ? lines.slice(1) : lines).map((line) => {
        const cols = line.split(',').map(c => c.trim())
        return {
          campaign_id: selectedCampaign,
          date: cols[0],
          play_count: parseInt(cols[1]) || 0,
          total_duration_seconds: parseInt(cols[2]) || 0,
          unique_taxis: parseInt(cols[3]) || 0,
          km_covered: parseFloat(cols[4]) || 0,
        }
      })

      const { error: insertError } = await supabase.from('play_stats').insert(rows)

      if (insertError) throw insertError

      setSuccess(`${rows.length} rows imported successfully`)
      setCsvData('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'CSV import failed')
    }
    setUploading(false)
  }

  const handleVehhubImport = async () => {
    if (!vehhubData.trim()) {
      setError('Paste the vehhub.top play log export data')
      return
    }

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const lines = vehhubData.trim().split('\n')
      // Skip header row — vehhub.top exports:
      // Device Id, Alias, Duration(s), Begin Play Time, AD Name, Latitude, Longitude
      const firstLine = lines[0].toLowerCase()
      const hasHeader = firstLine.includes('device') || firstLine.includes('duration') || firstLine.includes('begin')
      const dataLines = hasHeader ? lines.slice(1) : lines

      if (dataLines.length === 0) {
        throw new Error('No data rows found')
      }

      // Parse raw play entries and group by campaign name + date
      const statsMap: Record<string, {
        campaign_name: string
        date: string
        play_count: number
        total_duration: number
        device_ids: Set<string>
      }> = {}

      for (const line of dataLines) {
        const cols = line.split(',').map(c => c.trim())
        if (cols.length < 5) continue

        const deviceId = cols[0]
        const duration = parseInt(cols[2]) || 0
        const beginPlayTime = cols[3]
        const adName = cols[4]

        if (!adName || !beginPlayTime) continue

        // Extract date from "2024-05-24 13:54:20 +0000 CST" or "2024-05-24 13:54:20"
        const date = beginPlayTime.split(' ')[0]
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue

        const key = `${adName.toLowerCase()}_${date}`

        if (!statsMap[key]) {
          statsMap[key] = {
            campaign_name: adName,
            date,
            play_count: 0,
            total_duration: 0,
            device_ids: new Set(),
          }
        }
        statsMap[key].play_count++
        statsMap[key].total_duration += duration
        statsMap[key].device_ids.add(deviceId)
      }

      const entries = Object.values(statsMap)
      if (entries.length === 0) {
        throw new Error('Could not parse any valid play log entries')
      }

      // Match campaign names to our DB
      const { data: allCampaigns } = await supabase
        .from('campaigns')
        .select('id, name')

      const campaignLookup = new Map(
        (allCampaigns || []).map(c => [c.name.toLowerCase(), c.id])
      )

      let inserted = 0
      let skipped = 0
      const unmatchedNames = new Set<string>()

      for (const entry of entries) {
        const campaignId = campaignLookup.get(entry.campaign_name.toLowerCase())
        if (!campaignId) {
          unmatchedNames.add(entry.campaign_name)
          skipped += entry.play_count
          continue
        }

        // Check if stats row already exists for this campaign+date
        const { data: existing } = await supabase
          .from('play_stats')
          .select('id, play_count, total_duration_seconds, unique_taxis')
          .eq('campaign_id', campaignId)
          .eq('date', entry.date)
          .maybeSingle()

        if (existing) {
          await supabase.from('play_stats').update({
            play_count: existing.play_count + entry.play_count,
            total_duration_seconds: existing.total_duration_seconds + entry.total_duration,
            unique_taxis: (existing.unique_taxis || 0) + entry.device_ids.size,
          }).eq('id', existing.id)
        } else {
          await supabase.from('play_stats').insert({
            campaign_id: campaignId,
            date: entry.date,
            play_count: entry.play_count,
            total_duration_seconds: entry.total_duration,
            unique_taxis: entry.device_ids.size,
            km_covered: 0,
          })
        }
        inserted += entry.play_count
      }

      let msg = `Imported ${inserted} plays across ${entries.length - unmatchedNames.size} date(s)`
      if (unmatchedNames.size > 0) {
        msg += `. Skipped ${skipped} plays — no matching campaign for: ${[...unmatchedNames].join(', ')}`
      }
      setSuccess(msg)
      setVehhubData('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'VehHub import failed')
    }
    setUploading(false)
  }

  if (loading) return <div className="portal-loading">Loading...</div>

  return (
    <div className="portal-page">
      <h1 className="portal-page-title">Upload Play Stats</h1>
      <p className="portal-subtitle">Import play statistics from vehhub.top exports</p>

      <div className="admin-mode-toggle">
        <button className={`admin-filter-btn ${mode === 'vehhub' ? 'active' : ''}`} onClick={() => setMode('vehhub')}>VehHub Export</button>
        <button className={`admin-filter-btn ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>Manual Entry</button>
        <button className={`admin-filter-btn ${mode === 'csv' ? 'active' : ''}`} onClick={() => setMode('csv')}>CSV Import</button>
      </div>

      {mode !== 'vehhub' && (
        <div className="portal-input-group" style={{ marginBottom: '1.5rem' }}>
          <label>Campaign</label>
          <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}>
            <option value="">Select a campaign...</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.clients?.company_name}</option>
            ))}
          </select>
        </div>
      )}

      {error && <div className="portal-login-error">{error}</div>}
      {success && <div className="portal-success-msg"><CheckCircle size={16} /> {success}</div>}

      {mode === 'vehhub' ? (
        <div className="portal-form">
          <div className="portal-input-group">
            <label>Paste VehHub Play Log Export</label>
            <p className="input-hint">
              Go to vehhub.top &rarr; Vehicle Group Ads &rarr; click Play Log icon &rarr; switch to List view &rarr; click Export.
              Then open the CSV and paste the contents here. Campaigns are matched automatically by ad name.
            </p>
            <textarea
              value={vehhubData}
              onChange={(e) => setVehhubData(e.target.value)}
              placeholder={`Device Id,Alias,Duration(s),Begin Play Time,AD Name,Latitude,Longitude\ny1c-825-61009,,10,2025-01-15 14:53:04 +0000 CST,summer sale promo,41.7151,44.8271\ny1c-825-61009,,10,2025-01-15 14:53:14 +0000 CST,summer sale promo,41.7152,44.8272`}
              rows={12}
            />
          </div>
          <button onClick={handleVehhubImport} disabled={uploading} className="portal-btn-primary">
            <Upload size={16} /> {uploading ? 'Importing...' : 'Import VehHub Data'}
          </button>
        </div>
      ) : mode === 'manual' ? (
        <form onSubmit={handleManualSubmit} className="portal-form">
          <div className="admin-form-row">
            <div className="portal-input-group">
              <label>Date</label>
              <input type="date" value={manualEntry.date} onChange={(e) => setManualEntry({ ...manualEntry, date: e.target.value })} required />
            </div>
            <div className="portal-input-group">
              <label>Play Count</label>
              <input type="number" value={manualEntry.play_count} onChange={(e) => setManualEntry({ ...manualEntry, play_count: parseInt(e.target.value) })} min={0} />
            </div>
          </div>
          <div className="admin-form-row">
            <div className="portal-input-group">
              <label>Total Duration (seconds)</label>
              <input type="number" value={manualEntry.total_duration_seconds} onChange={(e) => setManualEntry({ ...manualEntry, total_duration_seconds: parseInt(e.target.value) })} min={0} />
            </div>
            <div className="portal-input-group">
              <label>Unique Taxis</label>
              <input type="number" value={manualEntry.unique_taxis} onChange={(e) => setManualEntry({ ...manualEntry, unique_taxis: parseInt(e.target.value) })} min={0} />
            </div>
            <div className="portal-input-group">
              <label>KM Covered</label>
              <input type="number" value={manualEntry.km_covered} onChange={(e) => setManualEntry({ ...manualEntry, km_covered: parseFloat(e.target.value) })} min={0} step="0.1" />
            </div>
          </div>
          <button type="submit" disabled={uploading} className="portal-btn-primary">
            {uploading ? 'Saving...' : 'Add Stats'}
          </button>
        </form>
      ) : (
        <div className="portal-form">
          <div className="portal-input-group">
            <label>Paste CSV Data</label>
            <p className="input-hint">Format: date, play_count, duration_seconds, unique_taxis, km_covered</p>
            <textarea
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              placeholder={`2025-01-15, 120, 3600, 5, 45.2\n2025-01-16, 98, 2940, 4, 38.7`}
              rows={10}
            />
          </div>
          <button onClick={handleCsvUpload} disabled={uploading} className="portal-btn-primary">
            <Upload size={16} /> {uploading ? 'Importing...' : 'Import CSV'}
          </button>
        </div>
      )}
    </div>
  )
}
