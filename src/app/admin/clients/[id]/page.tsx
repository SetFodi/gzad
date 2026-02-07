'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface ClientDetail {
  id: string
  email: string
  company_name: string
  contact_name: string
  phone: string
  created_at: string
}

interface Campaign {
  id: string
  name: string
  status: string
  start_date: string
  end_date: string
  monthly_price: number
}

interface Invoice {
  id: string
  amount: number
  status: string
  due_date: string
  paid_at: string | null
}

export default function AdminClientDetailPage() {
  const params = useParams()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const id = params.id as string

      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single()

      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false })

      const { data: invoiceData } = await supabase
        .from('invoices')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false })

      setClient(clientData)
      setCampaigns(campaignData || [])
      setInvoices(invoiceData || [])
      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) return <div className="portal-loading">Loading...</div>
  if (!client) return <div className="portal-loading">Client not found</div>

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0)
  const totalPending = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.amount, 0)

  return (
    <div className="portal-page">
      <Link href="/admin/clients" className="portal-back-link">
        <ArrowLeft size={16} /> Back to Clients
      </Link>

      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">{client.company_name}</h1>
          <p className="portal-subtitle">{client.contact_name} &middot; {client.email} {client.phone ? `&middot; ${client.phone}` : ''}</p>
        </div>
      </div>

      <div className="stats-grid three-col">
        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-value">{campaigns.length}</span>
            <span className="stat-card-label">Campaigns</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-value" style={{ color: '#CCF381' }}>{totalRevenue} GEL</span>
            <span className="stat-card-label">Total Paid</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-info">
            <span className="stat-card-value" style={{ color: '#FBBF24' }}>{totalPending} GEL</span>
            <span className="stat-card-label">Pending</span>
          </div>
        </div>
      </div>

      {campaigns.length > 0 && (
        <div className="portal-section">
          <h2>Campaigns</h2>
          <div className="campaigns-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Period</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/portal/dashboard/campaigns/${c.id}`} className="table-link">{c.name}</Link>
                    </td>
                    <td>
                      <span className="status-badge" style={{
                        color: c.status === 'active' ? '#CCF381' : c.status === 'pending_review' ? '#FBBF24' : '#64748B',
                        borderColor: c.status === 'active' ? '#CCF381' : c.status === 'pending_review' ? '#FBBF24' : '#64748B',
                      }}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{c.start_date || '—'} → {c.end_date || '—'}</td>
                    <td>{c.monthly_price ? `${c.monthly_price} GEL/mo` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {invoices.length > 0 && (
        <div className="portal-section">
          <h2>Invoices</h2>
          <div className="campaigns-table-wrapper">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.amount} GEL</td>
                    <td>
                      <span className="status-badge" style={{
                        color: inv.status === 'paid' ? '#CCF381' : inv.status === 'pending' ? '#FBBF24' : '#EF4444',
                        borderColor: inv.status === 'paid' ? '#CCF381' : inv.status === 'pending' ? '#FBBF24' : '#EF4444',
                      }}>
                        {inv.status}
                      </span>
                    </td>
                    <td>{inv.due_date}</td>
                    <td>{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
