import assert from 'node:assert/strict';
import test from 'node:test';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import { parsePreflightRequestPayload } from '../frontend/app/api/preflight/_lib/preflight-request';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import type { PricingContext } from '../frontend/src/lib/pricing-context';
import { computeConfiguredPreflight } from '../frontend/src/server/engines';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { buildTariffBatchPlan } from '../frontend/server/pricing-admin/tariff-batches/planner';
import { gpt26RasterProposal } from '../frontend/server/pricing-admin/tariff-batches/gpt26';
import type { PreflightRequest } from '../frontend/types/engines';

const policy = { status: 'loaded' as const, rules: [] };
const state = { status: 'loaded' as const, active: true, revision: 1,
  databaseCells: [] as ManualTariffCell[], versionedCells: [] as ManualTariffCell[] };

for (const variant of ['flare', 'sunburst'] as const) {
  test(`GPT 2.6 ${variant} generic preflight preserves automatic and custom image pricing settings`, async () => {
    const modelId = `gpt-image-2-6-${variant}` as const;
    const engine = getFalEngineById(modelId)!.engine;
    const plan = await buildTariffBatchPlan({ proposal: gpt26RasterProposal(modelId), state, policy });
    const quote = (context: PricingContext) => computeCanonicalPublicSnapshot(context, {
      loadCustomerTariffState: async () => ({ ...state, databaseCells: plan.rows.map(row => row.proposedCell!) }),
      pricingPolicy: { loadOverrides: async () => policy },
    });
    for (const scenario of [
      { resolution: 'auto', quality: 'auto', complexity: 'low', mode: 't2i', refs: 0 },
      { resolution: 'custom', quality: 'xhigh', complexity: 'medium', mode: 'i2i', refs: 16,
        customImageSize: { width: 1616, height: 912 } },
      { resolution: '3840x2160', quality: 'low', complexity: 'high', mode: 't2i', refs: 0 },
    ] as const) {
      const customImageSize = 'customImageSize' in scenario ? scenario.customImageSize : undefined;
      const parsed = parsePreflightRequestPayload({ engine: modelId, mode: scenario.mode,
        durationSec: 10, resolution: scenario.resolution, extraInputValues: {
          quality: scenario.quality, complexity: scenario.complexity,
          ...(customImageSize ? { image_width: customImageSize.width, image_height: customImageSize.height } : {}),
        } });
      assert.equal(parsed.ok, true);
      if (!parsed.ok) return;
      let received: PricingContext | undefined;
      const result = await computeConfiguredPreflight(parsed.request as PreflightRequest, {
        resolvedEngine: engine, bootstrap: false, trustedMediaPricingFacts: { referenceImageCount: scenario.refs },
        computePublicSnapshot: async context => { received = context; return quote(context); },
      });
      assert.equal(result.ok, true, result.error?.message);
      assert.equal(received?.resolution, scenario.resolution);
      assert.equal(received?.quality, scenario.quality);
      assert.equal(received?.complexity, scenario.complexity);
      assert.equal(received?.durationSec, 10);
      assert.deepEqual(received?.customImageSize, customImageSize);
      assert.equal(received?.referenceImageCount, scenario.refs);
      const expected = await quote({ engine, mode: scenario.mode, resolution: scenario.resolution,
        durationSec: 10, quality: scenario.quality, complexity: scenario.complexity,
        customImageSize, referenceImageCount: scenario.refs });
      assert.equal(result.total, expected.totalCents);
      if (scenario.resolution === 'auto') {
        assert.equal(result.pricing?.meta?.providerCostKind, 'conservative-list-output-bound');
        assert.equal(result.pricing?.meta?.providerOutputImageTokens, null);
      }
    }
  });
}

test('GPT 2.6 generic preflight rejects invalid raster settings before the quote owner', async () => {
  const engine = getFalEngineById('gpt-image-2-6-flare')!.engine;
  const base: PreflightRequest = { engine: engine.id, mode: 't2i', durationSec: 1, resolution: '1024x1024' };
  for (const changes of [
    { resolution: '720p' }, { durationSec: 11 }, { durationSec: 1.5 },
    { extraInputValues: { quality: 'ultra' } }, { extraInputValues: { complexity: 'auto' } },
    { resolution: 'custom', extraInputValues: { image_width: 1920, image_height: 1080 } },
    { resolution: 'custom', extraInputValues: { image_width: 1024 } },
    { resolution: 'auto', extraInputValues: { image_width: 1024, image_height: 1024 } },
  ] as Partial<PreflightRequest>[]) {
    let calls = 0;
    const result = await computeConfiguredPreflight({ ...base, ...changes }, {
      resolvedEngine: engine, bootstrap: false,
      computePublicSnapshot: async () => { calls++; throw new Error('Invalid settings reached pricing'); },
    });
    assert.equal(result.ok, false);
    assert.equal(calls, 0, JSON.stringify(changes));
  }
});

test('legacy image preflight retains its existing automatic-size fallback', async () => {
  const engine = getFalEngineById('gpt-image-2')!.engine;
  let received: PricingContext | undefined;
  await computeConfiguredPreflight({ engine: engine.id, mode: 't2i', durationSec: 4, resolution: 'auto' }, {
    resolvedEngine: engine, bootstrap: false,
    computePublicSnapshot: async context => { received = context; throw new Error('Offline context capture'); },
  });
  assert.equal(received?.resolution, engine.resolutions.find(value => value !== 'auto'));
  assert.equal(received?.durationSec, 4);
  assert.equal(received?.quality, undefined);
  assert.equal(received?.customImageSize, undefined);
});
