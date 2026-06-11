import { query } from '@/lib/db';

export async function ensureBillingProductsSchema(): Promise<void> {
    await query(`
      CREATE TABLE IF NOT EXISTS app_billing_products (
        product_key TEXT PRIMARY KEY,
        surface TEXT NOT NULL,
        label TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        unit_kind TEXT NOT NULL CHECK (unit_kind IN ('image','run')),
        unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await query(`
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
        ('character-draft', 'character', 'Character Draft', 'USD', 'image', 8, TRUE, '{"seeded":true,"tool":"character-builder","qualityMode":"draft"}'::jsonb),
        ('character-final', 'character', 'Character Final', 'USD', 'image', 15, TRUE, '{"seeded":true,"tool":"character-builder","qualityMode":"final"}'::jsonb),
        ('angle-flux-single', 'angle', 'Angle FLUX Single', 'USD', 'run', 4, TRUE, '{"seeded":true,"tool":"angle","engineId":"flux-multiple-angles","variant":"single"}'::jsonb),
        ('angle-flux-multi', 'angle', 'Angle FLUX Multi', 'USD', 'run', 24, TRUE, '{"seeded":true,"tool":"angle","engineId":"flux-multiple-angles","variant":"multi"}'::jsonb),
        ('angle-qwen-single', 'angle', 'Angle Qwen Single', 'USD', 'run', 7, TRUE, '{"seeded":true,"tool":"angle","engineId":"qwen-multiple-angles","variant":"single"}'::jsonb),
        ('angle-qwen-multi', 'angle', 'Angle Qwen Multi', 'USD', 'run', 40, TRUE, '{"seeded":true,"tool":"angle","engineId":"qwen-multiple-angles","variant":"multi"}'::jsonb),
        ('upscale-image-seedvr', 'upscale', 'Upscale Image SeedVR2', 'USD', 'run', 4, TRUE, '{"seeded":true,"tool":"upscale","engineId":"seedvr-image","mediaType":"image"}'::jsonb),
        ('upscale-image-topaz', 'upscale', 'Upscale Image Topaz', 'USD', 'run', 12, TRUE, '{"seeded":true,"tool":"upscale","engineId":"topaz-image","mediaType":"image"}'::jsonb),
        ('upscale-image-recraft-crisp', 'upscale', 'Upscale Image Recraft Crisp', 'USD', 'run', 2, TRUE, '{"seeded":true,"tool":"upscale","engineId":"recraft-crisp","mediaType":"image"}'::jsonb),
        ('upscale-video-seedvr', 'upscale', 'Upscale Video SeedVR2', 'USD', 'run', 25, TRUE, '{"seeded":true,"tool":"upscale","engineId":"seedvr-video","mediaType":"video","dynamicPricing":true}'::jsonb),
        ('upscale-video-flashvsr', 'upscale', 'Upscale Video FlashVSR', 'USD', 'run', 18, TRUE, '{"seeded":true,"tool":"upscale","engineId":"flashvsr-video","mediaType":"video","dynamicPricing":true}'::jsonb),
        ('upscale-video-topaz', 'upscale', 'Upscale Video Topaz', 'USD', 'run', 80, TRUE, '{"seeded":true,"tool":"upscale","engineId":"topaz-video","mediaType":"video","dynamicPricing":true}'::jsonb),
        ('background-removal-video-v3', 'background-removal', 'Background Removal Video Bria VRMBG 3.0', 'USD', 'run', 5, TRUE, '{"seeded":true,"tool":"background-removal","engineId":"bria-video-background-removal-v3","dynamicPricing":true}'::jsonb),
        ('background-removal-realtime', 'background-removal', 'Background Removal Realtime Bria VRMBG 3.0', 'USD', 'run', 10, TRUE, '{"seeded":true,"tool":"background-removal","engineId":"bria-video-background-removal-realtime","dynamicPricing":true}'::jsonb)
      ON CONFLICT (product_key) DO NOTHING;
    `);

    await query(`
      UPDATE app_billing_products
         SET active = FALSE,
             metadata = COALESCE(metadata, '{}'::jsonb) || '{"legacy":true}'::jsonb,
             updated_at = NOW()
       WHERE product_key IN ('angle-single', 'angle-multi')
         AND COALESCE(metadata->>'legacy', 'false') <> 'true';
    `);
}
