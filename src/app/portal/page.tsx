import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: client } = await supabase
      .from('clients')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (client?.role === 'fleet') {
      redirect('/fleet')
    }
    redirect('/portal/dashboard')
  } else {
    redirect('/portal/login')
  }
}
