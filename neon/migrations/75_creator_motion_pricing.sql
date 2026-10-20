-- Tool-specific billing domain, not a published generation model. Release remains gated separately.
INSERT INTO app_pricing_rules(id,engine_id,margin_percent,margin_flat_cents,surcharge_audio_percent,surcharge_upscale_percent,currency,compatibility_profile)
VALUES('toolbox-motion-control','toolbox-motion-control',1.5,0,0,0,'USD','standard') ON CONFLICT(id) DO NOTHING;
