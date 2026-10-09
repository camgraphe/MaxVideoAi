import assert from 'node:assert/strict';
import test from 'node:test';
import { PRICING_ENGINES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-config';
import { computeComparePricingPoints, getCompareReferenceDuration } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-pricing-scenarios';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import type { PublicModelQuoteInput } from '../frontend/lib/pricing-public-model-contract';
import type { PricingContext } from '../frontend/lib/pricing-context';
import type { PricingSnapshot } from '@maxvideoai/pricing';

test('Veo and Omni reference clips use a common admitted four-second duration', async () => {
  const veo = PRICING_ENGINES.get('veo-3-1')!;
  for (const other of ['veo-3-1-fast', 'veo-3-1-lite', 'gemini-omni-flash']) {
    const engine = PRICING_ENGINES.get(other)!;
    const duration = getCompareReferenceDuration(veo, engine);
    assert.equal(duration, 4);
    const quoted: PublicModelQuoteInput[] = [];
    const points = await computeComparePricingPoints(engine, duration, async input => {
      assert.ok(resolvePublicModelScenario(input), 'every quoted reference is admitted by the canonical contract');
      quoted.push(input);
      return { status: 'exact', amountCents: 54, currency: 'USD', revision: 'fixture', scenarioLabel: 'fixture' };
    });
    assert.ok(points.length >= 2);
    assert.ok(quoted.every(input => input.durationSec === 4 && input.mode === 't2v' && input.audio === true && input.aspectRatio === '16:9'));
    assert.ok(points.every(point => point.cents === 13.5 && point.scenario?.amountCents === 54));
    assert.deepEqual(points.map(point => point.resolution), other === 'veo-3-1-lite' ? ['720p', '1080p'] : ['720p', '1080p', '4k']);
  }
});

test('unavailable quotes remain absent and a missing engine cannot invent a reference duration', async () => {
  assert.equal(getCompareReferenceDuration(undefined, PRICING_ENGINES.get('veo-3-1')), undefined);
  const points = await computeComparePricingPoints(PRICING_ENGINES.get('veo-3-1-fast')!, 5, async () => ({ status: 'unavailable' }));
  assert.deepEqual(points, []);
});

// Break caught: replacing the contextual adapter with catalogue-normalized inputs
// drops the caller's pricing engine, membership, video flags or audio addons.
test('an injected snapshot reader receives the unchanged comparison pricing context', async () => {
  const base = PRICING_ENGINES.get('veo-3-1-fast')!;
  for (const audio of [true, false]) {
    const engine = { ...base, audio, pricingDetails: { ...base.pricingDetails,
      perSecondCents: { default: 123 }, addons: { audio_off: { perSecondCents: -10 } } } };
    const contexts: PricingContext[] = [];
    const points = await computeComparePricingPoints(engine, 5, undefined, async context => {
      contexts.push(context);
      return { totalCents: 54, currency: 'USD' } as PricingSnapshot;
    });
    assert.deepEqual(contexts, ['720p', '1080p', '4k'].map(resolution => ({
      engine, mode: 't2v', durationSec: 4, resolution, aspectRatio: '16:9',
      membershipTier: 'member', hasVideoInput: false, inputVideoDurationSec: 0,
      addons: audio ? { audio: true } : { audio_off: true, audio: false },
    })));
    assert.ok(contexts.every(context => context.engine === engine));
    assert.equal(points.length, 3);
    assert.ok(points.every(point => point.scenario?.amountCents === 54 && point.cents === 13.5));
  }
});

test('the existing quote callback takes precedence over the optional contextual reader', async () => {
  let contextualCalls = 0;
  const points = await computeComparePricingPoints(PRICING_ENGINES.get('veo-3-1')!, 4,
    async () => ({ status: 'exact', amountCents: 40, currency: 'USD' }), async () => {
      contextualCalls++;
      throw new Error('unused contextual reader');
    });
  assert.equal(contextualCalls, 0);
  assert.deepEqual(points.map(point => point.cents), [10, 10, 10]);
});

test('contextual zero totals stay valid while failed, negative and unsafe totals are filtered', async () => {
  const engine = PRICING_ENGINES.get('veo-3-1')!;
  for (const invalid of [-1, Number.MAX_SAFE_INTEGER + 1, 0.5]) {
    const points = await computeComparePricingPoints(engine, 4, undefined, async context => {
      if (context.resolution === '4k') throw new Error('unavailable snapshot');
      return { totalCents: context.resolution === '720p' ? 0 : invalid, currency: 'USD' } as PricingSnapshot;
    });
    assert.deepEqual(points.map(point => [point.resolution, point.cents, point.scenario?.amountCents]), [['720p', 0, 0]]);
  }
  assert.deepEqual(await computeComparePricingPoints(engine, 4, undefined,
    async () => ({ totalCents: 10, currency: '' }) as PricingSnapshot), []);
});

test('an absent text-to-video mode never calls the contextual reader', async () => {
  let reads = 0;
  assert.deepEqual(await computeComparePricingPoints({ ...PRICING_ENGINES.get('veo-3-1')!, id: 'missing-engine' },
    4, undefined, async () => { reads++; throw new Error('unused'); }), []);
  assert.equal(reads, 0);
});
