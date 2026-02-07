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
  const [manualEntry, setManualEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    play_count: 0,
    total_duration_seconds: 0,
    unique_taxis: 0,
    km_covered: 0,
  })
  const [mode, setMode] = useState<'manual' | 'csv'>('manual')
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

  if (loading) return <div className="portal-loading">Loading...</div>

  return (
    <div className="portal-page">
      <h1 className="portal-page-title">Upload Play Stats</h1>
      <p className="portal-subtitle">Import play statistics from vehhub.top exports</p>

      <div className="portal-input-group" style={{ marginBottom: '1.5rem' }}>
        <label>Campaign</label>
        <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}>
          <option value="">Select a campaign...</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.name} — {c.clients?.company_name}</option>
          ))}
        </select>
      </div>

      <div className="admin-mode-toggle">
        <button className={`admin-filter-btn ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>Manual Entry</button>
        <button className={`admin-filter-btn ${mode === 'csv' ? 'active' : ''}`} onClick={() => setMode('csv')}>CSV Import</button>
      </div>

      {error && <div className="portal-login-error">{error}</div>}
      {success && <div className="portal-success-msg"><CheckCircle size={16} /> {success}</div>}

      {mode === 'manual' ? (
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
