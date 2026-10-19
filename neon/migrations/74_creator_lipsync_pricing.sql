-- Tool-specific provider domain, not a published generation model. No release flag is enabled here.
INSERT INTO app_pricing_rules(id,engine_id,margin_percent,margin_flat_cents,surcharge_audio_percent,surcharge_upscale_percent,currency,compatibility_profile)
VALUES('toolbox-lip-sync','toolbox-lip-sync',1.5,0,0,0,'USD','standard') ON CONFLICT(id) DO NOTHING;
ALTER TABLE creator_operations ADD COLUMN IF NOT EXISTS provider_state text CHECK(provider_state IN ('submitting','pending','persisting','completed','failed','ambiguous'));
ALTER TABLE creator_operations ADD COLUMN IF NOT EXISTS provider_request_id text;
ALTER TABLE creator_operations ADD COLUMN IF NOT EXISTS provider_started_at timestamptz;
ALTER TABLE creator_operations ADD COLUMN IF NOT EXISTS provider_lease_token uuid;
ALTER TABLE creator_operations ADD COLUMN IF NOT EXISTS provider_lease_expires_at timestamptz;
