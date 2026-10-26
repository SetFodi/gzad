'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { DollarSign, MapPin, Clock, Users, Receipt, Save, Plus, Minus, Map } from 'lucide-react'
import { TBILISI_DISTRICTS } from '@/lib/districts'

const DistrictMapEditor = dynamic(() => import('@/components/admin/DistrictMapEditor'), { ssr: false })

const DISTRICTS = [
  'Mtatsminda', 'Vake', 'Saburtalo', 'Chughureti', 'Didube',
  'Nadzaladevi', 'Gldani', 'Isani', 'Samgori', 'Krtsanisi',
]

interface EditableDistrict {
  name: string
  color: string
  polygon: [number, number][]
}

const TIME_LABELS: Record<string, { label: string; color: string }> = {
  '0.75': { label: 'Off-Peak', color: 'var(--portal-muted)' },
  '1.00': { label: 'Standard', color: 'var(--portal-info)' },
  '1.15': { label: 'Nightlife', color: 'var(--portal-brass)' },
  '1.30': { label: 'Rush Hour', color: 'var(--portal-warning)' },
}

function formatGEL(n: number): string {
  return `${n.toFixed(2)} ₾`
}

interface ClientRow {
  id: string
  company_name: string
  balance: number
}

interface BillingLog {
  id: string
  client_id: string
  campaign_id: string
  device_id: string
  period_start: string
  district: string
  district_tier: number
  base_rate: number
  district_multiplier: number
  time_multiplier: number
  total_cost: number
  ad_duration_seconds: number
  // From migration 010 (metered billing); absent on older databases.
  billing_unit?: 'slot_hour' | 'block_10m'
  plays?: number | null
  expected_plays?: number | null
  proration?: number | null
  campaigns?: { name: string } | null
  clients?: { company_name: string } | null
}

export default function PricingPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'rates' | 'districts' | 'time' | 'balances' | 'history' | 'map'>('rates')

  // Pricing config
  const [baseRates, setBaseRates] = useState<Record<string, number>>({})
  const [districtTiers, setDistrictTiers] = useState<Record<string, number>>({})
  const [districtMultipliers, setDistrictMultipliers] = useState<Record<string, number>>({})
  const [timeMultipliers, setTimeMultipliers] = useState<Record<string, number>>({})

  // Clients & billing
  const [clients, setClients] = useState<ClientRow[]>([])
  const [billingLogs, setBillingLogs] = useState<BillingLog[]>([])
  const [topUpAmounts, setTopUpAmounts] = useState<Record<string, string>>({})
  const [balanceMsg, setBalanceMsg] = useState<{ ok: boolean; msg: string } | null>(null)

  // Map editor
  const [editableDistricts, setEditableDistricts] = useState<EditableDistrict[]>([])
  const [selectedMapDistrict, setSelectedMapDistrict] = useState<string | null>(null)
  const [mapDirty, setMapDirty] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/immutability -- load() is async: state is set once the query resolves, not during render
  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setLoadError(false)
    try {
      const logColumns = 'id, client_id, campaign_id, device_id, period_start, district, district_tier, base_rate, district_multiplier, time_multiplier, total_cost, ad_duration_seconds, campaigns(name), clients(company_name)'
      const recentLogs = (columns: string) =>
        supabase.from('billing_logs').select(columns).order('period_start', { ascending: false }).limit(100)
      const [configRes, clientsRes, meteredLogsRes] = await Promise.all([
        supabase.from('pricing_config').select('key, value'),
        supabase.from('clients').select('id, company_name, balance').eq('is_admin', false).neq('role', 'fleet').order('company_name'),
        recentLogs(`${logColumns}, billing_unit, plays, expected_plays, proration`),
      ])
      // Before migration 010 the metering columns don't exist yet.
      const logsRes = meteredLogsRes.error ? await recentLogs(logColumns) : meteredLogsRes

      const failedRead = [configRes, clientsRes, logsRes].find(result => result.error)
      if (failedRead) throw failedRead.error

      const cfg: Record<string, Record<string, number>> = {}
      for (const c of configRes.data || []) cfg[c.key] = c.value as Record<string, number>

      const required = ['base_rates', 'district_tiers', 'district_multipliers', 'time_multipliers']
      if (required.some(key => !cfg[key] || typeof cfg[key] !== 'object' || Array.isArray(cfg[key]))) {
        throw new Error('Pricing configuration is missing')
      }
      if (['10', '20', '30'].some(key => !Number.isFinite(cfg.base_rates[key]) || cfg.base_rates[key] < 0)
        || ['1', '2', '3', '4'].some(key => !Number.isFinite(cfg.district_multipliers[key]) || cfg.district_multipliers[key] < 0)
        || Object.values(cfg.district_tiers).some(tier => !Number.isInteger(tier) || tier < 1 || tier > 4)
        || Object.entries(cfg.time_multipliers).some(([hour, value]) => !/^(?:[0-9]|1[0-9]|2[0-3])$/.test(hour) || !Number.isFinite(value) || value < 0)) {
        throw new Error('Pricing configuration is invalid')
      }

      setBaseRates(cfg.base_rates)
      setDistrictTiers(cfg.district_tiers)
      setDistrictMultipliers(cfg.district_multipliers)
      setTimeMultipliers(cfg.time_multipliers)
      setClients(clientsRes.data || [])
      setBillingLogs((logsRes.data || []) as unknown as BillingLog[])

      // Load district polygons: DB override or hardcoded defaults
      const savedPolygons = cfg.district_polygons as unknown as Record<string, { color: string; polygon: [number, number][] }> | undefined
      if (savedPolygons && Object.keys(savedPolygons).length > 0) {
        setEditableDistricts(Object.entries(savedPolygons).map(([name, data]) => ({
          name,
          color: data.color,
          polygon: data.polygon,
        })))
      } else {
        setEditableDistricts(TBILISI_DISTRICTS.map(d => ({
          name: d.name,
          color: d.color,
          polygon: [...d.polygon],
        })))
      }
      setMapDirty(false)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig(key: string, value: Record<string, number>) {
    setSaving(true)
    await supabase.from('pricing_config').upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
    setSaving(false)
  }

  // Balance changes go through the server so each one is applied atomically and
  // recorded in the ledger with the admin who made it. The database rejects
  // direct writes to clients.balance.
  async function adjustBalance(clientId: string, amount: number) {
    if (!amount || amount === 0) return

    setBalanceMsg(null)
    try {
      const res = await fetch('/api/admin/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, amount }),
      })
      const result = await res.json()

      if (!res.ok) {
        setBalanceMsg({ ok: false, msg: result.error || 'Balance update failed' })
        return
      }

      const resumed = result.reactivated
        ? ` ${result.reactivated} campaign(s) resumed on ${result.devicesSynced} device(s).`
        : ''
      setBalanceMsg({
        ok: true,
        msg: `Balance updated to ${formatGEL(result.balance)}.${resumed}`,
      })
      setTopUpAmounts(prev => ({ ...prev, [clientId]: '' }))
      await load()
    } catch {
      setBalanceMsg({ ok: false, msg: 'Could not reach the server' })
    }
  }

  if (loadError) return (
    <div className="portal-page">
      <div className="portal-empty" role="alert">
        <p>Could not load pricing and balances from the database. No rates have been substituted. Please try again.</p>
        <button type="button" className="portal-btn-primary" onClick={() => void load()}>Try again</button>
      </div>
    </div>
  )

  if (loading) return <div className="portal-loading">Loading...</div>

  const vakeTier = districtTiers.Vake ?? 4
  const vakeMultiplier = districtMultipliers[vakeTier.toString()]
  const rushMultiplier = timeMultipliers['8'] ?? 1
  const gldaniTier = districtTiers.Gldani ?? 4
  const gldaniMultiplier = districtMultipliers[gldaniTier.toString()]
  const offPeakMultiplier = timeMultipliers['2'] ?? 1

  const tabs = [
    { key: 'rates', label: 'Rates', icon: DollarSign },
    { key: 'districts', label: 'Districts', icon: MapPin },
    { key: 'time', label: 'Time of day', icon: Clock },
    { key: 'map', label: 'Map', icon: Map },
    { key: 'balances', label: 'Balances', icon: Users },
    { key: 'history', label: 'History', icon: Receipt },
  ] as const

  return (
    <div className="portal-page">
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">Pricing</h1>
          <p className="portal-subtitle">Rates, district and time multipliers, and client balances. Changes apply to the next billing run.</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--portal-info-soft)' }}>
            <DollarSign size={24} color="var(--portal-info)" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{formatGEL(clients.reduce((s, c) => s + c.balance, 0))}</span>
            <span className="stat-card-label">Total client balance</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--portal-success-soft)' }}>
            <Users size={24} color="var(--portal-success)" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{clients.filter(c => c.balance > 0).length} / {clients.length}</span>
            <span className="stat-card-label">Clients with balance</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'var(--portal-fill)' }}>
            <Receipt size={24} color="var(--portal-brass)" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{formatGEL(billingLogs.reduce((s, l) => s + Number(l.total_cost), 0))}</span>
            <span className="stat-card-label">Last 100 charges</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="segmented" role="tablist" aria-label="Pricing sections" style={{ marginTop: 28, marginBottom: 24 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon size={14} aria-hidden style={{ verticalAlign: -2, marginRight: 6 }} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="portal-section">

        {/* ── Base Rates ── */}
        {activeTab === 'rates' && (
          <>
            <h2>Base rates <span style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 400 }}>per taxi-slot-hour</span></h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Ad length</th>
                    <th style={{ textAlign: 'right' }}>Rate per hour</th>
                  </tr>
                </thead>
                <tbody>
                  {['10', '20', '30'].map(dur => (
                    <tr key={dur}>
                      <td style={{ fontWeight: 600 }}>{dur} seconds</td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number"
                          step="0.1"
                          value={baseRates[dur] ?? 0}
                          onChange={e => setBaseRates({ ...baseRates, [dur]: parseFloat(e.target.value) || 0 })}
                          style={{
                            width: 100, textAlign: 'right', padding: '4px 8px',
                            background: 'var(--card)', color: 'var(--foreground)',
                            border: '1px solid var(--border)', borderRadius: 6, fontSize: 14,
                          }}
                        />
                        <span style={{ marginLeft: 6, color: 'var(--muted-foreground)' }}>₾</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => saveConfig('base_rates', baseRates)}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
                  borderRadius: 980, border: 'none', background: 'var(--portal-primary)', color: 'var(--portal-on-primary)',
                  cursor: 'pointer', fontSize: 14, fontWeight: 500, opacity: saving ? 0.6 : 1,
                }}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save rates'}
              </button>
            </div>

            {/* Example calculation */}
            <div style={{
              marginTop: 24, padding: 16, borderRadius: 12,
              background: 'var(--portal-surface)', border: '1px solid var(--portal-hairline)',
            }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Example</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.8 }}>
                10s slot in <strong>Vake</strong> (Tier {vakeTier}, {vakeMultiplier.toFixed(2)}x) at <strong>08:00</strong> ({rushMultiplier.toFixed(2)}x):<br />
                {formatGEL(baseRates['10'])} × {vakeMultiplier.toFixed(2)} × {rushMultiplier.toFixed(2)} = <strong>{formatGEL(baseRates['10'] * vakeMultiplier * rushMultiplier)}</strong> per taxi-slot-hour<br />
                <br />
                30s slot in <strong>Gldani</strong> (Tier {gldaniTier}, {gldaniMultiplier.toFixed(2)}x) at <strong>02:00</strong> ({offPeakMultiplier.toFixed(2)}x):<br />
                {formatGEL(baseRates['30'])} × {gldaniMultiplier.toFixed(2)} × {offPeakMultiplier.toFixed(2)} = <strong>{formatGEL(baseRates['30'] * gldaniMultiplier * offPeakMultiplier)}</strong> per taxi-slot-hour
              </p>
            </div>
          </>
        )}

        {/* ── District Tiers ── */}
        {activeTab === 'districts' && (
          <>
            <h2>District tiers</h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Tier</th>
                    <th style={{ textAlign: 'right' }}>Multiplier</th>
                    <th style={{ textAlign: 'right' }}>Effective 10s Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {DISTRICTS.map(name => {
                    const tier = districtTiers[name] ?? 4
                    const mult = districtMultipliers[tier.toString()] ?? 1.0
                    return (
                      <tr key={name}>
                        <td style={{ fontWeight: 600 }}>{name}</td>
                        <td>
                          <select
                            value={tier}
                            onChange={e => {
                              const updated = { ...districtTiers, [name]: parseInt(e.target.value) }
                              setDistrictTiers(updated)
                            }}
                            style={{
                              padding: '4px 8px', background: 'var(--card)', color: 'var(--foreground)',
                              border: '1px solid var(--border)', borderRadius: 6, fontSize: 14,
                            }}
                          >
                            <option value={1}>Tier 1 (Premium)</option>
                            <option value={2}>Tier 2</option>
                            <option value={3}>Tier 3</option>
                            <option value={4}>Tier 4 (Base)</option>
                          </select>
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{mult.toFixed(2)}x</td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatGEL(baseRates['10'] * mult)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Tier multiplier config */}
            <h3 style={{ marginTop: 24 }}>Tier multipliers</h3>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              {[1, 2, 3, 4].map(tier => (
                <div key={tier} style={{
                  padding: '12px 16px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--card)', minWidth: 120,
                }}>
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>Tier {tier}</div>
                  <input
                    type="number"
                    step="0.05"
                    value={districtMultipliers[tier.toString()] ?? 1}
                    onChange={e => setDistrictMultipliers({ ...districtMultipliers, [tier.toString()]: parseFloat(e.target.value) || 1 })}
                    style={{
                      width: 80, textAlign: 'center', padding: '4px', fontSize: 16, fontWeight: 600,
                      background: 'transparent', color: 'var(--foreground)',
                      border: '1px solid var(--border)', borderRadius: 6,
                    }}
                  />
                  <span style={{ marginLeft: 4, color: 'var(--muted-foreground)' }}>x</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={async () => { await saveConfig('district_tiers', districtTiers); await saveConfig('district_multipliers', districtMultipliers) }}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
                  borderRadius: 980, border: 'none', background: 'var(--portal-primary)', color: 'var(--portal-on-primary)',
                  cursor: 'pointer', fontSize: 14, fontWeight: 500, opacity: saving ? 0.6 : 1,
                }}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save districts'}
              </button>
            </div>
          </>
        )}

        {/* ── Time Multipliers ── */}
        {activeTab === 'time' && (
          <>
            <h2>Time of day</h2>

            {/* Visual schedule bar */}
            <div style={{
              display: 'flex', height: 48, borderRadius: 10, overflow: 'hidden',
              border: '1px solid var(--border)', marginBottom: 16,
            }}>
              {Array.from({ length: 24 }, (_, h) => {
                const mult = timeMultipliers[h.toString()] ?? 1.0
                const info = TIME_LABELS[mult.toFixed(2)] || { label: 'Custom', color: 'var(--portal-muted)' }
                return (
                  <div
                    key={h}
                    title={`${h.toString().padStart(2, '0')}:00 — ${info.label} (${mult}x)`}
                    style={{
                      flex: 1, background: info.color, opacity: 0.7 + (mult - 0.75) * 0.5,
                      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                      fontSize: 9, color: '#fff', paddingBottom: 2, cursor: 'default',
                    }}
                  >
                    {h % 3 === 0 ? `${h}` : ''}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
              {Object.entries(TIME_LABELS).map(([mult, info]) => (
                <div key={mult} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: info.color }} />
                  {info.label} ({mult}x)
                </div>
              ))}
            </div>

            {/* Editable table */}
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Time Window</th>
                    <th>Label</th>
                    <th style={{ textAlign: 'right' }}>Multiplier</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { range: '01:00 – 07:00', hours: [1, 2, 3, 4, 5, 6] },
                    { range: '07:00 – 10:00', hours: [7, 8, 9] },
                    { range: '10:00 – 17:00', hours: [10, 11, 12, 13, 14, 15, 16] },
                    { range: '17:00 – 20:00', hours: [17, 18, 19] },
                    { range: '20:00 – 01:00', hours: [20, 21, 22, 23, 0] },
                  ].map(slot => {
                    const mult = timeMultipliers[slot.hours[0].toString()] ?? 1.0
                    const info = TIME_LABELS[mult.toFixed(2)] || { label: 'Custom', color: 'var(--portal-muted)' }
                    return (
                      <tr key={slot.range}>
                        <td style={{ fontWeight: 600 }}>{slot.range}</td>
                        <td>
                          <span style={{ color: info.color, fontWeight: 500 }}>{info.label}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.05"
                            value={mult}
                            onChange={e => {
                              const v = parseFloat(e.target.value) || 1
                              const updated = { ...timeMultipliers }
                              for (const h of slot.hours) updated[h.toString()] = v
                              setTimeMultipliers(updated)
                            }}
                            style={{
                              width: 80, textAlign: 'right', padding: '4px 8px',
                              background: 'var(--card)', color: 'var(--foreground)',
                              border: '1px solid var(--border)', borderRadius: 6, fontSize: 14,
                            }}
                          />
                          <span style={{ marginLeft: 4, color: 'var(--muted-foreground)' }}>x</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => saveConfig('time_multipliers', timeMultipliers)}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
                  borderRadius: 980, border: 'none', background: 'var(--portal-primary)', color: 'var(--portal-on-primary)',
                  cursor: 'pointer', fontSize: 14, fontWeight: 500, opacity: saving ? 0.6 : 1,
                }}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save times'}
              </button>
            </div>
          </>
        )}

        {/* ── Client Balances ── */}
        {/* ── District Map Editor ── */}
        {activeTab === 'map' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>District boundaries</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {mapDirty && <span style={{ fontSize: 12, color: 'var(--portal-warning)' }}>Unsaved changes</span>}
                <button
                  onClick={async () => {
                    setSaving(true)
                    const polygonData: Record<string, { color: string; polygon: [number, number][] }> = {}
                    for (const d of editableDistricts) {
                      polygonData[d.name] = { color: d.color, polygon: d.polygon }
                    }
                    await saveConfig('district_polygons', polygonData as unknown as Record<string, number>)
                    setMapDirty(false)
                    setSaving(false)
                  }}
                  disabled={saving || !mapDirty}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
                    borderRadius: 8, border: 'none',
                    background: mapDirty ? 'var(--portal-primary)' : 'var(--border)',
                    color: mapDirty ? 'var(--portal-on-primary)' : 'var(--muted-foreground)',
                    cursor: mapDirty ? 'pointer' : 'default', fontSize: 14, fontWeight: 500,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  <Save size={16} /> {saving ? 'Saving...' : 'Save Boundaries'}
                </button>
              </div>
            </div>

            {/* District selector */}
            <div style={{
              display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12,
              padding: '10px 12px', background: 'var(--card)', borderRadius: 10,
              border: '1px solid var(--border)',
            }}>
              <button
                onClick={() => setSelectedMapDistrict(null)}
                style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                  border: '1px solid', cursor: 'pointer',
                  borderColor: !selectedMapDistrict ? 'var(--portal-info)' : 'var(--border)',
                  background: !selectedMapDistrict ? 'var(--portal-info-soft)' : 'transparent',
                  color: !selectedMapDistrict ? 'var(--portal-info)' : 'var(--muted-foreground)',
                }}
              >
                All
              </button>
              {editableDistricts.map(d => (
                <button
                  key={d.name}
                  onClick={() => setSelectedMapDistrict(d.name === selectedMapDistrict ? null : d.name)}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                    border: '1px solid', cursor: 'pointer',
                    borderColor: selectedMapDistrict === d.name ? d.color : 'var(--border)',
                    background: selectedMapDistrict === d.name ? `${d.color}18` : 'transparent',
                    color: selectedMapDistrict === d.name ? d.color : 'var(--muted-foreground)',
                  }}
                >
                  <span style={{
                    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                    background: d.color, marginRight: 6, verticalAlign: 'middle',
                  }} />
                  {d.name}
                  <span style={{ marginLeft: 4, opacity: 0.6 }}>({d.polygon.length})</span>
                </button>
              ))}
            </div>

            {/* Map */}
            <div style={{
              height: 520, borderRadius: '0.75rem', overflow: 'hidden',
              border: '1px solid var(--border)', marginBottom: 12,
            }}>
              <DistrictMapEditor
                districts={editableDistricts}
                selectedDistrict={selectedMapDistrict}
                onChange={(updated) => {
                  setEditableDistricts(updated)
                  setMapDirty(true)
                }}
              />
            </div>

            {/* Instructions */}
            <div style={{
              padding: 14, borderRadius: 10,
              background: 'var(--portal-surface)', border: '1px solid var(--portal-hairline)',
              fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.7,
            }}>
              <strong style={{ color: 'var(--foreground)' }}>How to edit:</strong><br />
              Select a district above to focus on it. Drag vertices to adjust boundaries.<br />
              Click the faint dots between vertices to add a new point. Right-click a vertex to remove it.
            </div>
          </>
        )}

        {activeTab === 'balances' && (
          <>
            <h2>Client balances</h2>
            {balanceMsg && (
              <div style={{
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 16,
                background: balanceMsg.ok ? 'var(--portal-success-soft)' : 'var(--portal-danger-soft)',
                color: balanceMsg.ok ? 'var(--portal-success)' : 'var(--portal-danger)',
              }}>
                {balanceMsg.msg}
              </div>
            )}
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                    <th style={{ textAlign: 'right' }}>Top Up / Deduct</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {clients.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>No clients</td></tr>
                  ) : clients.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.company_name}</td>
                      <td style={{
                        textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                        color: c.balance <= 0 ? 'var(--portal-danger)' : 'var(--portal-success)',
                      }}>
                        {formatGEL(c.balance)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <input
                          type="number"
                          step="1"
                          placeholder="Amount (₾)"
                          value={topUpAmounts[c.id] || ''}
                          onChange={e => setTopUpAmounts({ ...topUpAmounts, [c.id]: e.target.value })}
                          style={{
                            width: 120, textAlign: 'right', padding: '4px 8px',
                            background: 'var(--card)', color: 'var(--foreground)',
                            border: '1px solid var(--border)', borderRadius: 6, fontSize: 14,
                          }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => adjustBalance(c.id, parseFloat(topUpAmounts[c.id] || '0'))}
                            title="Add balance"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px',
                              borderRadius: 6, border: 'none', background: 'var(--portal-success)', color: 'var(--portal-on-primary)',
                              cursor: 'pointer', fontSize: 12, fontWeight: 500,
                            }}
                          >
                            <Plus size={14} /> Add
                          </button>
                          <button
                            onClick={() => {
                              const amt = parseFloat(topUpAmounts[c.id] || '0')
                              if (amt > 0) adjustBalance(c.id, -amt)
                            }}
                            title="Deduct balance"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px',
                              borderRadius: 6, border: '1px solid var(--border)', background: 'transparent',
                              color: 'var(--muted-foreground)', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                            }}
                          >
                            <Minus size={14} /> Deduct
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Billing History ── */}
        {activeTab === 'history' && (
          <>
            <h2>Recent charges</h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Client</th>
                    <th>Campaign</th>
                    <th>Device</th>
                    <th>District</th>
                    <th style={{ textAlign: 'right' }}>Base</th>
                    <th style={{ textAlign: 'right' }}>Dist ×</th>
                    <th style={{ textAlign: 'right' }}>Time ×</th>
                    <th style={{ textAlign: 'right' }}>Played</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {billingLogs.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>No billing history yet</td></tr>
                  ) : billingLogs.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(l.period_start).toLocaleString('en-GB', { timeZone: 'Asia/Tbilisi', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>{l.clients?.company_name || '—'}</td>
                      <td>{l.campaigns?.name || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{l.device_id?.slice(0, 12)}...</td>
                      <td>{l.district} <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>(T{l.district_tier})</span></td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatGEL(l.base_rate)}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{l.district_multiplier.toFixed(2)}x</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{l.time_multiplier.toFixed(2)}x</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--muted-foreground)' }}>
                        {l.billing_unit === 'block_10m' && l.proration != null
                          ? `${l.plays}/${l.expected_plays} · ${Math.round(Number(l.proration) * 100)}%`
                          : 'full hour'}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatGEL(Number(l.total_cost))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
