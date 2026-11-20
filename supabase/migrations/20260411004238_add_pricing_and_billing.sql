
-- Add balance to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS balance numeric NOT NULL DEFAULT 0;

-- Add slot duration to campaigns (10, 20, or 30 seconds)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS slot_duration integer NOT NULL DEFAULT 10;

-- Pricing configuration (key-value store)
CREATE TABLE IF NOT EXISTS pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Default pricing config
INSERT INTO pricing_config (key, value) VALUES
  ('base_rates', '{"10": 2.0, "20": 3.4, "30": 4.6}'),
  ('district_tiers', '{"Mtatsminda": 1, "Vake": 1, "Saburtalo": 2, "Chughureti": 2, "Didube": 3, "Nadzaladevi": 3, "Gldani": 4, "Isani": 3, "Samgori": 4, "Krtsanisi": 4}'),
  ('district_multipliers', '{"1": 1.45, "2": 1.25, "3": 1.10, "4": 1.00}'),
  ('time_multipliers', '{"0": 1.15, "1": 0.75, "2": 0.75, "3": 0.75, "4": 0.75, "5": 0.75, "6": 0.75, "7": 1.30, "8": 1.30, "9": 1.30, "10": 1.00, "11": 1.00, "12": 1.00, "13": 1.00, "14": 1.00, "15": 1.00, "16": 1.00, "17": 1.30, "18": 1.30, "19": 1.30, "20": 1.15, "21": 1.15, "22": 1.15, "23": 1.15}')
ON CONFLICT (key) DO NOTHING;

-- Billing log for audit trail
CREATE TABLE IF NOT EXISTS billing_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  device_id text,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  base_rate numeric NOT NULL,
  district text,
  district_tier integer,
  district_multiplier numeric NOT NULL DEFAULT 1.0,
  time_multiplier numeric NOT NULL DEFAULT 1.0,
  total_cost numeric NOT NULL,
  ad_duration_seconds integer NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_logs_client ON billing_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_billing_logs_campaign ON billing_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_billing_logs_period ON billing_logs(period_start);
-- Prevent double-billing for the same slot-hour
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_logs_unique_slot
  ON billing_logs(campaign_id, device_id, period_start);
;
