-- Explicit initial subtitle transcription policy. Existing commercial overrides are preserved.
-- This migration does not enable a public tool or provider execution.
INSERT INTO app_pricing_rules (
  id, engine_id, margin_percent, margin_flat_cents,
  surcharge_audio_percent, surcharge_upscale_percent, currency, compatibility_profile
) VALUES ('toolbox-subtitles', 'toolbox-subtitles', 1.5, 0, 0, 0, 'USD', 'standard')
ON CONFLICT (id) DO NOTHING;
