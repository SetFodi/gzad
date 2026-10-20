import { createServerClient } from '@supabase/ssr'
import { AuthSessionMissingError } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { sessionApproved } from '@/lib/auth/session'
import { AUTH_DEVICE_COOKIE } from '@/lib/auth/trust'

export async function createClient() {
  const cookieStore = await cookies()

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore in Server Components
          }
        },
      },
    }
  )
  const originalGetUser = client.auth.getUser.bind(client.auth)
  client.auth.getUser = async (...args) => {
    const result = await originalGetUser(...args)
    if (result.data.user && !await sessionApproved(client, result.data.user, cookieStore.get(AUTH_DEVICE_COOKIE)?.value, await headers())) {
      return { data: { user: null }, error: new AuthSessionMissingError() }
    }
    return result
  }
  return client
}
