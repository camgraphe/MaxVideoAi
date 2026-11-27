import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { createEnginesGetHandler } from '../frontend/app/api/engines/_lib/engines-get-handler';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { PURCHASE_ROUTING_ENGINE_IDS } from '../frontend/src/lib/video-purchase-decision';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { resolveVideoOperationEngine } from '../frontend/lib/video-operation';
import type { EngineCaps } from '../frontend/types/engines';

const catalog = getBaseEnginesByCategory('video');
const request = new NextRequest('https://example.test/api/engines');
const deps = {
  resolveLaunchCanaryRequestContext: async () => null,
  loadAppEngineScoreMap: async () => ({}),
  loadAppEngineScoreReviewMap: async () => ({}),
};

for (const degraded of [false, true]) {
  test(`engine catalog retains customer settings and excludes purchase terms (degraded=${degraded})`, async () => {
    const handler = createEnginesGetHandler({
      ...deps,
      getPublicConfiguredEnginesByCategory: async () => {
        if (degraded) throw new Error('injected catalog outage');
        return catalog.map((engine) => ({ ...engine, vendorAccountId: 'private-account' }));
      },
    });
    const { engines, degraded: responseDegraded } = await (await handler(request)).json() as {
      engines: EngineCaps[];
      degraded?: boolean;
    };
    assert.equal(Boolean(responseDegraded), degraded);
    for (const id of PURCHASE_ROUTING_ENGINE_IDS) {
      const engine = engines.find((entry) => entry.id === id);
      const canonical = catalog.find((entry) => entry.id === id);
      assert.ok(engine && canonical, id);
      assert.ok(canonical.pricingDetails, id);
      assert.equal(engine.provider, canonical.provider, id);
      assert.deepEqual(engine.resolutions, canonical.resolutions, id);
      assert.ok(engine.modes.includes('t2v') && engine.inputSchema, id);
      assert.doesNotMatch(JSON.stringify(engine), /"(pricing|pricingDetails|providerMeta|vendorAccountId|transport|endpoint)"|provider cost|platform margin|private-account/i, id);
    }
    for (const [id, operation] of [
      ['kling-o3-pro', 'kling-edit'], ['minimax-h3-max', 'h3-recast'], ['minimax-h3-max', 'h3-relight'],
    ] as const) {
      const canonical = resolveVideoOperationEngine(catalog.find((entry) => entry.id === id)!, 'v2v', operation);
      const customer = resolveVideoOperationEngine(engines.find((entry) => entry.id === id)!, 'v2v', operation);
      assert.equal(customer.inputLimits.videoMaxDurationSec, canonical.inputLimits.videoMaxDurationSec, operation);
      assert.deepEqual(customer.inputSchema, JSON.parse(JSON.stringify(canonical.inputSchema)), operation);
    }
  });
}

test('the customer-facing Wan picker notes explain the price basis without publishing supplier rates', () => {
  for (const id of ['wan-3', 'wan-3-prime']) {
    const note = getFalEngineById(id)?.billingNote;
    assert.ok(note?.includes('resolution'));
    assert.doesNotMatch(note, /\$[0-9]|margin|provider cost/i);
  }
});
