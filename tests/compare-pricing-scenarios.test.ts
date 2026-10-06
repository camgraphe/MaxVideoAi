import assert from 'node:assert/strict';
import test from 'node:test';
import { PRICING_ENGINES } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-config';
import { computeComparePricingPoints, getCompareReferenceDuration } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-pricing-scenarios';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import type { PublicModelQuoteInput } from '../frontend/lib/pricing-public-model-contract';

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
