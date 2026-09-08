-- Add the selected tools' explicit policy without changing any existing product.
-- Preserve an already configured rule; commercial activation remains separately gated.
INSERT INTO app_pricing_rules (
  id, engine_id, margin_percent, margin_flat_cents,
  surcharge_audio_percent, surcharge_upscale_percent, currency, compatibility_profile
) VALUES ('toolbox-finishing', 'toolbox-finishing', 1.5, 0, 0, 0, 'USD', 'standard')
ON CONFLICT (id) DO NOTHING;
