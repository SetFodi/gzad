import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parsePricingConfig, type PricingConfig } from '@/lib/billing'
import ClientGuide from '@/components/education/ClientGuide'

export const metadata = { title: 'Campaign guide | Gzad', robots: { index: false, follow: false } }

export default async function GuidePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/portal/login')
  const { data: client } = await supabase.from('clients').select('role, is_admin').eq('auth_user_id', user.id).single()
  if (client?.is_admin || client?.role === 'admin') redirect('/admin')
  if (client?.role === 'fleet') redirect('/fleet')
  if (!client) redirect('/portal/login')

  const { data, error } = await supabase.from('pricing_config').select('key, value')
    .in('key', ['base_rates', 'district_tiers', 'district_multipliers', 'time_multipliers'])
  let config: PricingConfig | null = null
  if (!error && data) {
    const required = ['base_rates', 'district_tiers', 'district_multipliers', 'time_multipliers']
    const complete = required.every(key => data.some(row => row.key === key && row.value && typeof row.value === 'object' && !Array.isArray(row.value)))
    if (complete) {
      const candidate = parsePricingConfig(data)
      const savedBase = data.find(row => row.key === 'base_rates')!.value as Record<string, unknown>
      const values = [...Object.values(candidate.baseRates), ...Object.values(candidate.districtMultipliers), ...Object.values(candidate.timeMultipliers)]
      if (values.every(value => Number.isFinite(value) && value >= 0)
        && ['10', '20', '30'].every(key => key in savedBase)
        && ['1', '2', '3', '4'].every(key => key in candidate.districtMultipliers)
        && Object.keys(candidate.timeMultipliers).every(hour => /^(?:[0-9]|1[0-9]|2[0-3])$/.test(hour))
        && Object.values(candidate.districtTiers).every(tier => Number.isInteger(tier) && tier >= 1 && tier <= 4)) config = candidate
    }
  }
  const { welcome } = await searchParams
  return <ClientGuide config={config} welcome={welcome === '1'} />
}
