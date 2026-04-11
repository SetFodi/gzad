import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: admin } = await supabase
    .from('clients')
    .select('is_admin')
    .eq('auth_user_id', user.id)
    .single()

  if (!admin?.is_admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { vehicle_id, device_id } = await request.json()

  if (!vehicle_id) {
    return NextResponse.json({ error: 'Vehicle ID is required' }, { status: 400 })
  }

  // If device_id is null, unassign the device
  if (device_id === null) {
    const { error } = await supabase
      .from('fleet_vehicles')
      .update({ device_id: null })
      .eq('id', vehicle_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  }

  // Check that the device exists
  const { data: device } = await supabase
    .from('devices')
    .select('id')
    .eq('id', device_id)
    .single()

  if (!device) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 })
  }

  // Check if device is already assigned to another vehicle
  const { data: existingVehicle } = await supabase
    .from('fleet_vehicles')
    .select('id, license_plate')
    .eq('device_id', device_id)
    .neq('id', vehicle_id)
    .single()

  if (existingVehicle) {
    return NextResponse.json({
      error: `Device already assigned to vehicle ${existingVehicle.license_plate}`
    }, { status: 400 })
  }

  const { error } = await supabase
    .from('fleet_vehicles')
    .update({ device_id })
    .eq('id', vehicle_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
