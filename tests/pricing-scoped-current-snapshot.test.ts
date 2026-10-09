import assert from 'node:assert/strict';
import test from 'node:test';
import type { PricingPolicyOverrideLoadResult } from '../frontend/src/lib/pricing-rule-store';
import type { PricingContext } from '../frontend/lib/pricing-context';
import { PRICING_ENGINES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-config';
import * as pricing from '../frontend/server/pricing/quote-public';

const context: PricingContext = { engine: PRICING_ENGINES.get('veo-3-1-fast')!, mode: 't2v', durationSec: 4,
  resolution: '720p', membershipTier: 'member', hasVideoInput: false, inputVideoDurationSec: 0, addons: { audio: true } };
const policy = (marginPercent = 0.3): PricingPolicyOverrideLoadResult => ({ status: 'loaded', rules: [{ id: 'fixture',
  marginPercent, marginFlatCents: 0, currency: 'USD' }], routingRules: [{ id: 'fixture', marginPercent, marginFlatCents: 0,
  surchargeAudioPercent: 0, surchargeUpscalePercent: 0, currency: 'USD', vendorAccountId: 'acct_context_scope' }] });
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
function reader(load: () => Promise<PricingPolicyOverrideLoadResult>) {
  assert.equal(typeof pricing.createScopedCurrentPublicSnapshot, 'function', 'contextual-only factory stays in the light snapshot owner');
  return pricing.createScopedCurrentPublicSnapshot(load);
}

// Break caught: the contextual-only factory repeats reads, eagerly reads policy,
// loses routing/provenance, retains failures or leaks a policy between scopes.
test('contextual-only scopes lazily share successful complete policy and keep fresh scopes independent', async () => {
  let reads = 0, release!: (value: PricingPolicyOverrideLoadResult) => void;
  const held = new Promise<PricingPolicyOverrideLoadResult>(resolve => { release = resolve; });
  const snapshot = reader(() => { reads++; return held; });
  assert.equal(reads, 0);
  const pending = Array.from({ length: 6 }, () => snapshot(context));
  await flush(); assert.equal(reads, 1);
  release(policy());
  const expected = await pricing.computeCurrentPublicSnapshot(context, { pricingPolicy: { loadOverrides: async () => policy() } });
  assert.deepEqual(await Promise.all(pending), Array(6).fill(expected));
  assert.equal(expected.vendorAccountId, 'acct_context_scope');
  assert.deepEqual(await snapshot(context), expected);
  assert.equal(reads, 1);
  const fresh = await reader(async () => { reads++; return policy(0.8); })(context);
  assert.equal(reads, 2);
  assert.notEqual(fresh.totalCents, expected.totalCents);
});

for (const failure of ['unavailable', 'rejection', 'synchronous throw'] as const) {
  test(`contextual-only ${failure} shares the failed attempt and later work retries`, async () => {
    let reads = 0;
    const snapshot = reader(() => {
      if (++reads > 1) return Promise.resolve(policy());
      if (failure === 'synchronous throw') throw new Error('synchronous fixture failure');
      return failure === 'rejection' ? Promise.reject(new Error('rejected fixture policy'))
        : Promise.resolve({ status: 'unavailable', rules: [], errorCode: 'pricing_rules_query_failed' });
    });
    await Promise.all(Array.from({ length: 6 }, () => assert.rejects(snapshot(context))));
    assert.equal(reads, 1);
    const recovered = await snapshot(context);
    assert.ok(Number.isSafeInteger(recovered.totalCents));
    assert.deepEqual(await snapshot(context), recovered);
    assert.equal(reads, 2);
  });
}
