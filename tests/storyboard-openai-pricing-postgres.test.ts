import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getStoryboardEditOutputConfig, getStoryboardOutputConfig } from '../frontend/src/components/tools/storyboard/_lib/storyboard-templates';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { getDb } from '../frontend/src/lib/db';
import {
  getStoryboardKlingFirstFrameJobId,
  STORYBOARD_BILLING_ENGINE_ID,
  STORYBOARD_EDIT_SOURCE,
  STORYBOARD_IMAGE_ENGINE_ID,
  STORYBOARD_SOURCE,
} from '../frontend/src/lib/storyboard-pricing';
import { estimateWebImageGeneration } from '../frontend/src/server/images/estimate-image-generation';
import { resolveImageGenerationPricingSnapshot } from '../frontend/src/server/images/image-generation-pricing';
import {
  resolveIncludedKlingFirstFrameParentJobId,
  resolveStoryboardRequestBillingIdentity,
} from '../frontend/src/server/images/storyboard-image-billing';
import type { ImageGenerationRequest } from '../frontend/types/image-generation';
import type { TariffBatchProposal } from '../frontend/server/pricing-admin/tariff-batches/contract';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

const engine = getFalEngineById(STORYBOARD_IMAGE_ENGINE_ID)!.engine;
const base = { engineId: engine.id, mode: 'i2i', numImages: 1 } as const;

test('Storyboarder prices the direct OpenAI workflow identically in estimates and reservations', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-25T12:00:00Z') });
  const db = await startDisposablePostgres('storyboardprice');
  const original = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV,
    PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  try {
    await createPaidGenerationTestSchema(db.pool);
    for (const migration of [
      '27_pricing_admin_cockpit.sql', '28_storyboard_pricing_policy.sql',
      '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql',
    ]) {
      await db.pool.query(readFileSync(`neon/migrations/${migration}`, 'utf8'));
    }
    await db.pool.query("UPDATE app_pricing_rules SET effective_from = '2026-11-07' WHERE engine_id = 'storyboarder'");
    const tariffs = JSON.parse(readFileSync(
      'docs/launch/2026-11-07-gpt26-raster-tariffs/gpt-image-2-6-sunburst-raster.json', 'utf8',
    )) as TariffBatchProposal;
    const relevant = tariffs.selections.filter(({ selector }) =>
      selector.mode === 'i2i' && ['medium', 'high'].includes(selector.quality ?? ''));
    for (const [index, { selector, price }] of relevant.entries()) {
      const key = JSON.stringify(Object.entries(selector).sort(([a], [b]) => a.localeCompare(b)));
      await db.pool.query(
        `INSERT INTO app_customer_tariff_cells (id, selector_key, selector_json, price_json, currency, effective_from, revision, updated_by)
         VALUES ($1, $2, $3, $4, 'USD', '2026-11-07', 1, '11111111-1111-4111-8111-111111111111')`,
        [`storyboard-test-${index}`, key, selector, price],
      );
    }
    await db.pool.query('UPDATE app_customer_tariff_state SET active = TRUE, revision = 1');

    async function compare({
      config, source, metadata, referenceImageCount, editReferenceSize, price, includedParentJobId = null,
    }: {
      config: ReturnType<typeof getStoryboardOutputConfig>;
      source: ImageGenerationRequest['source'];
      metadata?: ImageGenerationRequest['metadata'];
      referenceImageCount: number;
      editReferenceSize?: { width: number; height: number };
      price: number;
      includedParentJobId?: string | null;
    }) {
      const estimate = await estimateWebImageGeneration({
        ...base, ...config, source, metadata, referenceImageCount,
        referenceImageSizes: editReferenceSize ? [editReferenceSize] : [],
      });
      const { pricing } = await resolveImageGenerationPricingSnapshot({
        ...config, engine, mode: base.mode, numImages: base.numImages, source, metadata: metadata ?? null,
        durationSec: 1, editReferenceSize, complexity: 'high', combinedImageCount: referenceImageCount,
        enableWebSearch: false, billingProductKey: null, billingQuantityMultiplier: 1,
        jobSurface: 'storyboard', includedKlingFirstFrameParentJobId: includedParentJobId,
        resolvedAspectRatio: null, trustedQuotedBilling: undefined,
        customerTariffRevision: String(estimate.pricing.meta?.customerTariffRevision),
      });
      if (includedParentJobId) {
        assert.equal(pricing.totalCents, 0);
        assert.equal(pricing.meta?.storyboard_included_parent_job_id, includedParentJobId);
        return;
      }
      assert.equal(estimate.pricing.totalCents, price);
      assert.equal(estimate.pricing.meta?.customerTariffRevision, 1);
      assert.equal(pricing.totalCents, price);
      assert.equal(pricing.meta?.providerCostIncomplete, true);
      if (metadata?.storyboard?.targetModel === 'kling') {
        assert.equal(pricing.meta.storyboard_kling_first_frame_total_cents, 12);
        assert.equal(pricing.meta.storyboard_board_total_cents, price - 12);
      }
    }

    for (const orientation of ['landscape', 'portrait'] as const) {
      for (const [tier, price] of [['hd', 12], ['4k', 33], ['ultra', 123]] as const) {
        for (const targetModel of ['seedance', 'kling'] as const) {
          for (const referenceImageCount of [1, 5]) {
            await compare({
              config: getStoryboardOutputConfig(tier, orientation), source: STORYBOARD_SOURCE,
              metadata: { storyboard: { role: 'board', targetModel } }, referenceImageCount,
              price: price + (targetModel === 'kling' ? 12 : 0),
            });
          }
        }
      }
    }
    for (const [editReferenceSize, price] of [
      [{ width: 1920, height: 1080 }, 8],
      [{ width: 2160, height: 3840 }, 22],
      [undefined, 30],
    ] as const) {
      await compare({ config: getStoryboardEditOutputConfig(editReferenceSize), source: STORYBOARD_EDIT_SOURCE,
        referenceImageCount: 1, editReferenceSize, price });
    }

    const parentJobId = 'storyboard_paid_portrait';
    const jobId = getStoryboardKlingFirstFrameJobId(parentJobId);
    const metadata = { storyboard: { role: 'kling_first_frame', targetModel: 'kling', parentJobId } } as const;
    await db.pool.query(
      `INSERT INTO app_jobs (job_id, user_id, surface, status, payment_status, final_price_cents, engine_id, settings_snapshot)
       VALUES ($1,'account-A','storyboard','completed','paid_wallet',45,$2,$3)`,
      [parentJobId, STORYBOARD_BILLING_ENGINE_ID, JSON.stringify({
        engineId: STORYBOARD_IMAGE_ENGINE_ID, storyboard: { role: 'board', targetModel: 'kling' },
        core: { resolution: '2160x3840' }, refs: { imageUrls: ['template', 'one-reference'] },
      })],
    );
    const config = getStoryboardOutputConfig('hd', 'portrait');
    const frame = { ...base, ...config, userId: 'account-A', jobId, jobSurface: 'storyboard', source: STORYBOARD_SOURCE,
      metadata, referenceImageCount: 2 } as const;
    assert.equal(await resolveIncludedKlingFirstFrameParentJobId(frame), parentJobId);
    await compare({ config, metadata, source: STORYBOARD_SOURCE,
      referenceImageCount: 2, price: 0, includedParentJobId: parentJobId });
    for (const invalid of [
      { jobId: 'storyboard_kling_first_frame_random' },
      { userId: 'account-B' },
      { resolution: '2160x3840' },
      { resolution: '2048x1152' },
      { referenceImageCount: 3 },
    ]) {
      await assert.rejects(resolveIncludedKlingFirstFrameParentJobId({ ...frame, ...invalid }),
        { code: invalid.userId ? 'storyboard_parent_invalid' : 'storyboard_first_frame_invalid' });
    }
    await db.pool.query("UPDATE app_jobs SET status='pending' WHERE job_id=$1", [parentJobId]);
    await assert.rejects(resolveIncludedKlingFirstFrameParentJobId(frame), { code: 'storyboard_parent_invalid' });
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('new Storyboarder requests reject legacy Fal routing and edit-forged bundle metadata', () => {
  const legacy = getFalEngineById('gpt-image-2')!.engine;
  const body = { ...base, source: STORYBOARD_EDIT_SOURCE, imageUrls: ['https://example.com/original.png'] };
  const context = { jobSurface: 'storyboard', engine, mode: base.mode, numImages: base.numImages, body, metadata: null } as const;
  assert.throws(() => resolveStoryboardRequestBillingIdentity({ ...context, engine: legacy }),
    { code: 'storyboard_model_changed' });
  assert.throws(() => resolveStoryboardRequestBillingIdentity({ ...context, metadata: {
    storyboard: { role: 'board', targetModel: 'kling' },
  } }), { code: 'storyboard_settings_invalid' });
  assert.equal(resolveStoryboardRequestBillingIdentity(context)?.engineId, STORYBOARD_BILLING_ENGINE_ID);
});
