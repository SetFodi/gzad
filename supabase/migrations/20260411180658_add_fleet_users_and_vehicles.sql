
-- Add role column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'client';

-- Migrate existing data: set admins to 'admin' role, others stay 'client'
UPDATE clients SET role = 'admin' WHERE is_admin = true;
UPDATE clients SET role = 'client' WHERE is_admin = false;

-- Create fleet_vehicles table
CREATE TABLE fleet_vehicles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fleet_user_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  make text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL,
  color text NOT NULL,
  license_plate text NOT NULL UNIQUE,
  device_id text REFERENCES devices(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups by fleet user
CREATE INDEX idx_fleet_vehicles_fleet_user_id ON fleet_vehicles(fleet_user_id);

-- Index for device assignment lookups
CREATE INDEX idx_fleet_vehicles_device_id ON fleet_vehicles(device_id);

-- Enable RLS on fleet_vehicles
ALTER TABLE fleet_vehicles ENABLE ROW LEVEL SECURITY;

-- Policy: fleet users can read their own vehicles
CREATE POLICY "Fleet users can view own vehicles" ON fleet_vehicles
  FOR SELECT USING (
    fleet_user_id IN (
      SELECT id FROM clients WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: fleet users can insert their own vehicles
CREATE POLICY "Fleet users can insert own vehicles" ON fleet_vehicles
  FOR INSERT WITH CHECK (
    fleet_user_id IN (
      SELECT id FROM clients WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: fleet users can update their own vehicles (but not device_id - admin only)
CREATE POLICY "Fleet users can update own vehicles" ON fleet_vehicles
  FOR UPDATE USING (
    fleet_user_id IN (
      SELECT id FROM clients WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: fleet users can delete their own vehicles
CREATE POLICY "Fleet users can delete own vehicles" ON fleet_vehicles
  FOR DELETE USING (
    fleet_user_id IN (
      SELECT id FROM clients WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: admins can do everything on fleet_vehicles
CREATE POLICY "Admins full access to fleet_vehicles" ON fleet_vehicles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clients WHERE auth_user_id = auth.uid() AND is_admin = true
    )
  );
;
