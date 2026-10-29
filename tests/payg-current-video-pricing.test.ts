import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCurrentPricingHubData, buildCurrentVideoPricingData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/currentPricingHubData';
import { buildPayAsYouGoPageData } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data';
import { getPayAsYouGoContent } from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content';
import type { PublicModelQuoteInput } from '../frontend/lib/pricing-public-model-contract';

// PAYG consumes only the video projection. Unrelated image/audio/tool quotes
// must not hold that page open, or leak authored fallback amounts into it.
test('PAYG preserves its whole localized projection with only the video quotes it consumes', async () => {
  for (const locale of ['en', 'fr', 'es'] as const) for (const unavailable of [false, true]) {
    const fullCalls: PublicModelQuoteInput[] = [];
    const videoCalls: PublicModelQuoteInput[] = [];
    const quote = (calls: PublicModelQuoteInput[]) => async (input: PublicModelQuoteInput) => {
      calls.push(input);
      return unavailable ? { status: 'unavailable' as const } : {
        status: 'exact' as const, amountCents: input.modelId.length * 17 + (input.durationSec ?? 1),
        currency: 'USD' as const, revision: 'controlled', scenarioLabel: 'Current exact scenario',
      };
    };
    let otherCalls = 0;
    const other = async () => { otherCalls++; return { totalCents: 987, currency: 'USD' }; };
    const full = await buildCurrentPricingHubData(locale, quote(fullCalls), { audio: other, product: other });
    const video = await buildCurrentVideoPricingData(locale, quote(videoCalls));
    assert.deepEqual(Object.keys(video), ['video'], 'The narrow owner must expose no unrefreshed pricing surface');
    assert.ok(fullCalls.length > videoCalls.length);
    assert.equal(otherCalls, 21);
    assert.equal(new Set(videoCalls.map(input => JSON.stringify(input))).size, videoCalls.length);
    for (const id of ['kling-v4', 'flux-3-max', 'minimax-h3', 'seedance-2-5']) {
      assert.ok(videoCalls.some(input => input.modelId === id), `${id} must receive current quotes`);
    }
    assert.deepEqual(videoCalls, fullCalls.filter(input => input.mode !== 't2i'));
    assert.deepEqual(video.video, full.video);
    const content = getPayAsYouGoContent(locale);
    assert.deepEqual(buildPayAsYouGoPageData({ locale, content, pricingHub: video }),
      buildPayAsYouGoPageData({ locale, content, pricingHub: full }),
      'Every hero price, scenario, row, budget, link and localized section stays identical');
  }
});
