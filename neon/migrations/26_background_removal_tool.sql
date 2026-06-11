ALTER TABLE media_assets
DROP CONSTRAINT IF EXISTS media_assets_source_check;

ALTER TABLE media_assets
ADD CONSTRAINT media_assets_source_check
CHECK (source IN ('upload','saved_job_output','storyboard','character','angle','upscale','background-removal','import'));

INSERT INTO app_billing_products (
  product_key,
  surface,
  label,
  currency,
  unit_kind,
  unit_price_cents,
  active,
  metadata
)
VALUES
  (
    'background-removal-video-v3',
    'background-removal',
    'Background Removal Video Bria VRMBG 3.0',
    'USD',
    'run',
    5,
    TRUE,
    '{"seeded":true,"tool":"background-removal","engineId":"bria-video-background-removal-v3","dynamicPricing":true}'::jsonb
  ),
  (
    'background-removal-realtime',
    'background-removal',
    'Background Removal Realtime Bria VRMBG 3.0',
    'USD',
    'run',
    10,
    TRUE,
    '{"seeded":true,"tool":"background-removal","engineId":"bria-video-background-removal-realtime","dynamicPricing":true}'::jsonb
  )
ON CONFLICT (product_key) DO NOTHING;
