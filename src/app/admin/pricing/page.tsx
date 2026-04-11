'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DollarSign, MapPin, Clock, Users, Receipt, Save, Plus, Minus } from 'lucide-react'

const DISTRICTS = [
  'Mtatsminda', 'Vake', 'Saburtalo', 'Chughureti', 'Didube',
  'Nadzaladevi', 'Gldani', 'Isani', 'Samgori', 'Krtsanisi',
]

const TIME_LABELS: Record<string, { label: string; color: string }> = {
  '0.75': { label: 'Off-Peak', color: '#64748B' },
  '1.00': { label: 'Standard', color: '#60A5FA' },
  '1.15': { label: 'Nightlife', color: '#A78BFA' },
  '1.30': { label: 'Rush Hour', color: '#F59E0B' },
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
  campaigns?: { name: string } | null
  clients?: { company_name: string } | null
}

export default function PricingPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'rates' | 'districts' | 'time' | 'balances' | 'history'>('rates')

  // Pricing config
  const [baseRates, setBaseRates] = useState<Record<string, number>>({ '10': 2.0, '20': 3.4, '30': 4.6 })
  const [districtTiers, setDistrictTiers] = useState<Record<string, number>>({})
  const [districtMultipliers, setDistrictMultipliers] = useState<Record<string, number>>({})
  const [timeMultipliers, setTimeMultipliers] = useState<Record<string, number>>({})

  // Clients & billing
  const [clients, setClients] = useState<ClientRow[]>([])
  const [billingLogs, setBillingLogs] = useState<BillingLog[]>([])
  const [topUpAmounts, setTopUpAmounts] = useState<Record<string, string>>({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [configRes, clientsRes, logsRes] = await Promise.all([
      supabase.from('pricing_config').select('key, value'),
      supabase.from('clients').select('id, company_name, balance').order('company_name'),
      supabase.from('billing_logs')
        .select('id, client_id, campaign_id, device_id, period_start, district, district_tier, base_rate, district_multiplier, time_multiplier, total_cost, ad_duration_seconds, campaigns(name), clients(company_name)')
        .order('period_start', { ascending: false })
        .limit(100),
    ])

    const cfg: Record<string, Record<string, number>> = {}
    for (const c of configRes.data || []) cfg[c.key] = c.value as Record<string, number>

    setBaseRates(cfg.base_rates || { '10': 2.0, '20': 3.4, '30': 4.6 })
    setDistrictTiers(cfg.district_tiers || {})
    setDistrictMultipliers(cfg.district_multipliers || { '1': 1.45, '2': 1.25, '3': 1.10, '4': 1.00 })
    setTimeMultipliers(cfg.time_multipliers || {})
    setClients(clientsRes.data || [])
    setBillingLogs((logsRes.data || []) as unknown as BillingLog[])
    setLoading(false)
  }

  async function saveConfig(key: string, value: Record<string, number>) {
    setSaving(true)
    await supabase.from('pricing_config').upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
    setSaving(false)
  }

  async function addBalance(clientId: string) {
    const amount = parseFloat(topUpAmounts[clientId] || '0')
    if (!amount || amount === 0) return

    const client = clients.find(c => c.id === clientId)
    if (!client) return

    const newBalance = Math.round((client.balance + amount) * 100) / 100
    await supabase.from('clients').update({ balance: newBalance }).eq('id', clientId)

    // If balance was restored and client had paused_billing campaigns, reactivate them
    if (newBalance > 0) {
      await supabase
        .from('campaigns')
        .update({ status: 'active' })
        .eq('client_id', clientId)
        .eq('status', 'paused_billing')
    }

    setTopUpAmounts({ ...topUpAmounts, [clientId]: '' })
    await load()
  }

  if (loading) return <div className="portal-loading">Loading...</div>

  const tabs = [
    { key: 'rates', label: 'Base Rates', icon: DollarSign },
    { key: 'districts', label: 'District Tiers', icon: MapPin },
    { key: 'time', label: 'Time Multipliers', icon: Clock },
    { key: 'balances', label: 'Client Balances', icon: Users },
    { key: 'history', label: 'Billing History', icon: Receipt },
  ] as const

  return (
    <div className="portal-page">
      <h1 className="portal-page-title">Pricing & Billing</h1>

      {/* Summary cards */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(96,165,250,0.1)' }}>
            <DollarSign size={24} color="#60A5FA" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{formatGEL(clients.reduce((s, c) => s + c.balance, 0))}</span>
            <span className="stat-card-label">Total Client Balance</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(22,101,52,0.1)' }}>
            <Users size={24} color="#166534" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{clients.filter(c => c.balance > 0).length} / {clients.length}</span>
            <span className="stat-card-label">Active / Total Clients</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(167,139,250,0.1)' }}>
            <Receipt size={24} color="#A78BFA" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{formatGEL(billingLogs.reduce((s, l) => s + l.total_cost, 0))}</span>
            <span className="stat-card-label">Recent Charges (last 100)</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid',
              borderColor: activeTab === tab.key ? '#60A5FA' : 'var(--border)',
              background: activeTab === tab.key ? 'rgba(96,165,250,0.1)' : 'transparent',
              color: activeTab === tab.key ? '#60A5FA' : 'var(--muted-foreground)',
              cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="portal-section">

        {/* ── Base Rates ── */}
        {activeTab === 'rates' && (
          <>
            <h2>Base Rate Card <span style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 400 }}>per taxi-slot-hour</span></h2>
            <div className="campaigns-table-wrapper">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Slot Duration</th>
                    <th style={{ textAlign: 'right' }}>Rate (GEL)</th>
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
                  borderRadius: 8, border: 'none', background: '#60A5FA', color: '#fff',
                  cursor: 'pointer', fontSize: 14, fontWeight: 500, opacity: saving ? 0.6 : 1,
                }}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save Rates'}
              </button>
            </div>

            {/* Example calculation */}
            <div style={{
              marginTop: 24, padding: 16, borderRadius: 12,
              background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)',
            }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Example Calculation</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.8 }}>
                10s slot in <strong>Vake</strong> (Tier 1, 1.45x) during <strong>Rush Hour</strong> (1.30x):<br />
                {formatGEL(baseRates['10'])} × 1.45 × 1.30 = <strong>{formatGEL(baseRates['10'] * 1.45 * 1.30)}</strong> per taxi-slot-hour<br />
                <br />
                30s slot in <strong>Gldani</strong> (Tier 4, 1.00x) during <strong>Off-Peak</strong> (0.75x):<br />
                {formatGEL(baseRates['30'])} × 1.00 × 0.75 = <strong>{formatGEL(baseRates['30'] * 1.00 * 0.75)}</strong> per taxi-slot-hour
              </p>
            </div>
          </>
        )}

        {/* ── District Tiers ── */}
        {activeTab === 'districts' && (
          <>
            <h2>District Tier Assignments</h2>
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
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatGEL((baseRates['10'] || 2) * mult)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Tier multiplier config */}
            <h3 style={{ marginTop: 24 }}>Tier Multipliers</h3>
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
                  borderRadius: 8, border: 'none', background: '#60A5FA', color: '#fff',
                  cursor: 'pointer', fontSize: 14, fontWeight: 500, opacity: saving ? 0.6 : 1,
                }}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save Districts'}
              </button>
            </div>
          </>
        )}

        {/* ── Time Multipliers ── */}
        {activeTab === 'time' && (
          <>
            <h2>Time-of-Day Multipliers</h2>

            {/* Visual schedule bar */}
            <div style={{
              display: 'flex', height: 48, borderRadius: 10, overflow: 'hidden',
              border: '1px solid var(--border)', marginBottom: 16,
            }}>
              {Array.from({ length: 24 }, (_, h) => {
                const mult = timeMultipliers[h.toString()] ?? 1.0
                const info = TIME_LABELS[mult.toFixed(2)] || { label: 'Custom', color: '#525252' }
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
                    const info = TIME_LABELS[mult.toFixed(2)] || { label: 'Custom', color: '#525252' }
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
                  borderRadius: 8, border: 'none', background: '#60A5FA', color: '#fff',
                  cursor: 'pointer', fontSize: 14, fontWeight: 500, opacity: saving ? 0.6 : 1,
                }}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save Time Config'}
              </button>
            </div>
          </>
        )}

        {/* ── Client Balances ── */}
        {activeTab === 'balances' && (
          <>
            <h2>Client Balances</h2>
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
                        color: c.balance <= 0 ? '#EF4444' : '#22c55e',
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
                            onClick={() => addBalance(c.id)}
                            title="Add balance"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 4, padding: '4px 12px',
                              borderRadius: 6, border: 'none', background: '#166534', color: '#fff',
                              cursor: 'pointer', fontSize: 12, fontWeight: 500,
                            }}
                          >
                            <Plus size={14} /> Add
                          </button>
                          <button
                            onClick={() => {
                              const amt = parseFloat(topUpAmounts[c.id] || '0')
                              if (amt > 0) {
                                setTopUpAmounts({ ...topUpAmounts, [c.id]: (-amt).toString() })
                                setTimeout(() => addBalance(c.id), 0)
                              }
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
            <h2>Recent Billing History</h2>
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
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {billingLogs.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>No billing history yet</td></tr>
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
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatGEL(l.total_cost)}</td>
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
