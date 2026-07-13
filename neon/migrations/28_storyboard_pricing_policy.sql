BEGIN;

INSERT INTO app_pricing_rules (
  id,
  engine_id,
  mode,
  margin_percent,
  margin_flat_cents,
  surcharge_audio_percent,
  surcharge_upscale_percent,
  currency,
  effective_from,
  created_at,
  updated_at
)
VALUES
  ('storyboard-generate', 'storyboarder', 'storyboard', 2, 0, 0.2, 0.5, 'USD', NOW(), NOW(), NOW()),
  ('storyboard-edit', 'storyboarder', 'storyboard_edit', 1, 0, 0.2, 0.5, 'USD', NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

COMMIT;
