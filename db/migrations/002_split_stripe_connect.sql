-- Adds vendor account support and Stripe tracking metadata
ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS vendor_account_id TEXT;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS vendor_account_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS vendor_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;

ALTER TABLE receipts
  DROP CONSTRAINT IF EXISTS receipts_type_check;

ALTER TABLE receipts
  ADD CONSTRAINT receipts_type_check CHECK (type IN ('topup', 'charge', 'refund'));
