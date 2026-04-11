import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const LICENSE_PLATE_REGEX = /^[A-Z]{2}\s?\d{3}\s?[A-Z]{2}$/

function getFleetUser(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return supabase
    .from('clients')
    .select('id, role')
    .eq('auth_user_id', userId)
    .single()
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await getFleetUser(supabase, user.id)
  if (!client || client.role !== 'fleet') {
    return NextResponse.json({ error: 'Fleet access required' }, { status: 403 })
  }

  const { data: vehicles } = await supabase
    .from('fleet_vehicles')
    .select('*')
    .eq('fleet_user_id', client.id)
    .order('created_at', { ascending: false })

  return NextResponse.json(vehicles || [])
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await getFleetUser(supabase, user.id)
  if (!client || client.role !== 'fleet') {
    return NextResponse.json({ error: 'Fleet access required' }, { status: 403 })
  }

  const { make, model, year, color, license_plate } = await request.json()

  if (!make || !model || !year || !color || !license_plate) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }

  const normalizedPlate = license_plate.toUpperCase().replace(/\s+/g, ' ').trim()
  if (!LICENSE_PLATE_REGEX.test(normalizedPlate.replace(/\s/g, ''))) {
    return NextResponse.json({ error: 'Invalid Georgian license plate format (XX 000 XX)' }, { status: 400 })
  }

  const currentYear = new Date().getFullYear()
  if (year < 1990 || year > currentYear + 1) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
  }

  const { data: vehicle, error } = await supabase
    .from('fleet_vehicles')
    .insert({
      fleet_user_id: client.id,
      make,
      model,
      year,
      color,
      license_plate: normalizedPlate,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This license plate is already registered' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json(vehicle)
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: client } = await getFleetUser(supabase, user.id)
  if (!client || client.role !== 'fleet') {
    return NextResponse.json({ error: 'Fleet access required' }, { status: 403 })
  }

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'Vehicle ID required' }, { status: 400 })

  const { error } = await supabase
    .from('fleet_vehicles')
    .delete()
    .eq('id', id)
    .eq('fleet_user_id', client.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
