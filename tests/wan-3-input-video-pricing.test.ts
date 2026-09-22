import assert from 'node:assert/strict';
import test from 'node:test';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts';
import { projectPublicPricingSnapshot, quotePublicPricing } from '../frontend/src/lib/pricing-public-quote';
import { getWan3InputVideoDurationSec, validateWan3PricingDuration } from '../frontend/src/lib/wan3-pricing';

for (const [id, expectedCents] of [['wan-3', 150], ['wan-3-prime', 210]] as const) {
  for (const mode of ['ref2v', 'v2v', 'extend'] as const) {
    test(`${id}/${mode} public and billing facts include a 10-second source plus 5-second output`, () => {
      const engine = getBaseEngines().find((entry) => entry.id === id)!;
      const context = { engine, mode, durationSec: 5, resolution: '720p', inputVideoDurationSec: 10, hasVideoInput: true };
      const billing = buildBillingPricingFacts(context, engine.pricingDetails, 'USD');
      const publicFacts = buildPublicPricingFacts(context);
      assert.equal(billing.facts.vendorSubtotalExactCents, expectedCents);
      assert.equal(publicFacts.facts.vendorSubtotalExactCents, expectedCents);
      assert.equal(publicFacts.base.seconds, 5, 'base presentation retains output duration');
      assert.deepEqual(publicFacts.addons, billing.addons);
      assert.equal(publicFacts.addons[0]?.type, 'input_video_duration');
      assert.equal(publicFacts.meta.input_video_duration_sec, 10);
      assert.equal(publicFacts.meta.billable_duration_sec, 15);
      assert.equal(publicFacts.base.amountCents, id === 'wan-3' ? 50 : 70);
      const quote = quotePublicPricing({
        facts: publicFacts.facts,
        scenario: { id: `${id}:${mode}`, engineId: id, mode, resolution: '720p' },
        compatibilityProfileId: publicFacts.compatibilityProfileId,
      });
      const snapshot = projectPublicPricingSnapshot({ quote, ...publicFacts });
      assert.equal(snapshot.totalCents, id === 'wan-3' ? 195 : 273);
      assert.equal(snapshot.vendorShareCents, expectedCents);
    });
  }
}

test('owned Wan video duration sums unique video URLs and retains the largest aliased record', () => {
  assert.equal(getWan3InputVideoDurationSec([
    { kind: 'video', url: 'https://media.test/a.mp4', durationSec: 3.25 },
    { kind: 'image', url: 'https://media.test/a.png' },
    { kind: 'audio', url: 'https://media.test/a.wav', durationSec: 8 },
    { kind: 'video', url: 'https://media.test/a.mp4', durationSec: 3.5 },
    { kind: 'video', url: 'https://media.test/b.mp4', durationSec: 2.25 },
  ]), 5.75);
  assert.equal(getWan3InputVideoDurationSec([{ kind: 'audio', durationSec: 8 }]), 0);
  for (const durationSec of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => getWan3InputVideoDurationSec([{ kind: 'video', url: 'https://media.test/a.mp4', durationSec }]), /Verified input-video duration/);
  }
  assert.throws(() => getWan3InputVideoDurationSec([{ kind: 'video', durationSec: 5 }]), /Verified input-video duration/);
});

test('Wan pricing retains fractional source seconds, input/output itemization, and configured provider rates', () => {
  const authoredEngine = getBaseEngines().find((entry) => entry.id === 'wan-3')!;
  const pricingDetails = { currency: 'USD', perSecondCents: { default: 12, byResolution: { '720p': 12 } } };
  const engine = { ...authoredEngine, pricingDetails };
  const context = { engine, mode: 'ref2v' as const, durationSec: 5, resolution: '720p', inputVideoDurationSec: 3.25 };
  const billing = buildBillingPricingFacts(context, pricingDetails, 'USD');
  const publicFacts = buildPublicPricingFacts({ ...context, useStandardDefinitionFacts: true });
  assert.deepEqual(billing, publicFacts);
  assert.equal(billing.facts.vendorSubtotalExactCents, 99);
  assert.equal(billing.base.amountCents, 60);
  assert.deepEqual(billing.addons, [{ type: 'input_video_duration', amountCents: 39 }]);
  assert.equal(billing.meta.billable_duration_sec, 8.25);
});

test('Wan modes without input video retain their existing output-only rate', () => {
  for (const [id, expectedCents] of [['wan-3', 50], ['wan-3-prime', 70]] as const) {
    const engine = getBaseEngines().find((entry) => entry.id === id)!;
    for (const mode of ['t2v', 'i2v', 'ref2v'] as const) {
      const context = { engine, mode, durationSec: 5, resolution: '720p', inputVideoDurationSec: 0 };
      const billing = buildBillingPricingFacts(context, engine.pricingDetails, 'USD');
      assert.equal(billing.facts.vendorSubtotalExactCents, expectedCents);
      assert.equal(billing.base.seconds, 5);
      assert.deepEqual(billing.addons, []);
      assert.deepEqual(billing, buildPublicPricingFacts(context));
    }
  }
});

test('Wan pricing fails closed for unknown source duration and out-of-contract duration totals', () => {
  for (const mode of ['v2v', 'extend', 'ref2v'] as const) {
    assert.throws(() => validateWan3PricingDuration({ mode, durationSec: 5, hasVideoInput: true }), /Verified input-video duration/);
    assert.throws(() => validateWan3PricingDuration({ mode, durationSec: 16, inputVideoDurationSec: 15 }), /30 seconds combined/);
    assert.equal(validateWan3PricingDuration({ mode, durationSec: 15, inputVideoDurationSec: 15 }).billableDurationSec, 30);
  }
  for (const durationSec of [0, 1, 2.5, 31, Number.NaN]) {
    assert.throws(() => validateWan3PricingDuration({ durationSec }), /integer from 2 to 30/);
  }
  for (const inputVideoDurationSec of [-1, 15.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => validateWan3PricingDuration({ mode: 'ref2v', durationSec: 5, inputVideoDurationSec }), /between 0 and 15/);
  }
  assert.throws(() => validateWan3PricingDuration({ mode: 't2v', durationSec: 5, inputVideoDurationSec: 5 }), /does not accept input video/);
  const engine = getBaseEngines().find((entry) => entry.id === 'wan-3')!;
  const context = { engine, mode: 'extend' as const, durationSec: 5, resolution: '720p' };
  assert.throws(() => buildBillingPricingFacts(context, engine.pricingDetails, 'USD'), /Verified input-video duration/);
  assert.throws(() => buildPublicPricingFacts(context), /Verified input-video duration/);
});
