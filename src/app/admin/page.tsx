'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Megaphone, Play, Receipt } from 'lucide-react'

interface Stats {
  totalClients: number
  activeCampaigns: number
  totalPlays: number
  pendingInvoices: number
  recentCampaigns: { id: string; name: string; status: string; company_name: string }[]
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { count: totalClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('is_admin', false)

      const { count: activeCampaigns } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      const { data: playData } = await supabase
        .from('play_stats')
        .select('play_count')

      const totalPlays = playData?.reduce((sum, p) => sum + p.play_count, 0) || 0

      const { count: pendingInvoices } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      const { data: recentCampaigns } = await supabase
        .from('campaigns')
        .select('id, name, status, clients(company_name)')
        .order('created_at', { ascending: false })
        .limit(5)

      setStats({
        totalClients: totalClients || 0,
        activeCampaigns: activeCampaigns || 0,
        totalPlays,
        pendingInvoices: pendingInvoices || 0,
        recentCampaigns: (recentCampaigns || []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          status: c.status as string,
          company_name: (c.clients as { company_name: string } | null)?.company_name || '—',
        })),
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="portal-loading">Loading...</div>
  if (!stats) return null

  return (
    <div className="portal-page">
      <h1 className="portal-page-title">Admin Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(96,165,250,0.1)' }}>
            <Users size={24} color="#60A5FA" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{stats.totalClients}</span>
            <span className="stat-card-label">Clients</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(204,243,129,0.1)' }}>
            <Megaphone size={24} color="#CCF381" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{stats.activeCampaigns}</span>
            <span className="stat-card-label">Active Campaigns</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(251,191,36,0.1)' }}>
            <Play size={24} color="#FBBF24" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{stats.totalPlays.toLocaleString()}</span>
            <span className="stat-card-label">Total Plays</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <Receipt size={24} color="#EF4444" />
          </div>
          <div className="stat-card-info">
            <span className="stat-card-value">{stats.pendingInvoices}</span>
            <span className="stat-card-label">Pending Invoices</span>
          </div>
        </div>
      </div>

      <div className="portal-section">
        <h2>Recent Campaigns</h2>
        <div className="campaigns-table-wrapper">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Client</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentCampaigns.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.company_name}</td>
                  <td>
                    <span className="status-badge" style={{
                      color: c.status === 'active' ? '#CCF381' : c.status === 'pending_review' ? '#FBBF24' : '#64748B',
                      borderColor: c.status === 'active' ? '#CCF381' : c.status === 'pending_review' ? '#FBBF24' : '#64748B',
                    }}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
