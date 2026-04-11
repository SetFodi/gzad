import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect /portal/dashboard routes
  if (request.nextUrl.pathname.startsWith('/portal/dashboard') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/portal/login'
    return NextResponse.redirect(url)
  }

  // Protect /fleet routes — must be logged in AND be fleet user
  if (request.nextUrl.pathname.startsWith('/fleet')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/portal/login'
      return NextResponse.redirect(url)
    }

    const { data: client } = await supabase
      .from('clients')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (!client || (client.role !== 'fleet' && client.role !== 'admin')) {
      const url = request.nextUrl.clone()
      url.pathname = '/portal/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Protect /admin routes — must be logged in AND be admin
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/portal/login'
      return NextResponse.redirect(url)
    }

    // Check if user is admin
    const { data: client } = await supabase
      .from('clients')
      .select('is_admin')
      .eq('auth_user_id', user.id)
      .single()

    if (!client?.is_admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/portal/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Redirect logged-in users away from login page based on role
  if ((request.nextUrl.pathname === '/portal/login' || request.nextUrl.pathname === '/portal/fleet-signup') && user) {
    const { data: client } = await supabase
      .from('clients')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    const url = request.nextUrl.clone()
    if (client?.role === 'fleet') {
      url.pathname = '/fleet'
    } else {
      url.pathname = '/portal/dashboard'
    }
    return NextResponse.redirect(url)
  }

  // Redirect fleet users away from /portal/dashboard to /fleet
  if (request.nextUrl.pathname.startsWith('/portal/dashboard') && user) {
    const { data: client } = await supabase
      .from('clients')
      .select('role')
      .eq('auth_user_id', user.id)
      .single()

    if (client?.role === 'fleet') {
      const url = request.nextUrl.clone()
      url.pathname = '/fleet'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/portal/:path*', '/admin/:path*', '/fleet/:path*'],
}
