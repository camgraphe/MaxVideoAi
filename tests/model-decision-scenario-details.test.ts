import assert from 'node:assert/strict';
import test from 'node:test';

import { getFalEngineById } from '../frontend/src/config/falEngines';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { buildCurrentModelDecisionData, refreshModelDecisionPricingScenarios } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/current-model-decision-pricing';
import { getModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry';
import { buildDecisionPricingScenarios } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing';
import type { PublicModelQuoteInput } from '../frontend/lib/pricing-public-model-contract';
import { readModelDecisionInput, buildModelDecisionDataFromContent } from './helpers/model-decision-content';
import { prepareModelCommercialData, type ModelPagePricing } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-commercial-data';

test('the existing Mini resolver selects actual defaults rather than the preset name', () => {
  const resolved = resolvePublicModelScenario({ modelId: 'seedance-2-0-mini', mode: 't2v', durationSec: 8, resolution: '480p' });
  assert.ok(resolved);
  assert.equal(resolved.context.addons?.audio, false);
  assert.equal(resolved.selector.aspectRatio, '16:9');
});

test('Mini monetary cards expose the exact priced scenario without changing inputs or totals', async () => {
  const entry = getFalEngineById('seedance-2-0-mini')!;
  const config = getModelPageTemplateConfig(entry.modelSlug)!;
  const authored = buildDecisionPricingScenarios(entry, 'en', config.pricing.presets);
  const calls: PublicModelQuoteInput[] = [];
  const current = await refreshModelDecisionPricingScenarios(entry, 'en', authored, config.pricing.presets,
    async input => { calls.push(input); return { status: 'exact', amountCents: 777, currency: 'USD', revision: 'current', scenarioLabel: 'current' }; },
    { showScenarioDetails: true });

  assert.equal(calls.length, 4);
  assert.deepEqual(calls[1], { modelId: entry.id, mode: 't2v', durationSec: 8, resolution: '480p' },
    'do not turn the 9x16 preset id into a new price request');
  assert.deepEqual(current[1].details, {
    seconds: 8, resolution: '480p', mode: 't2v', aspectRatio: '16:9', audio: false,
    referenceImages: 0, referenceVideoSeconds: 0,
  });
  assert.equal(current[1].value, '$7.77', 'use the returned total, not a rounded unit rate');
  assert.match(current[1].note, /8 s.*480p.*Text → Video.*16:9.*Audio off.*No references/);
  assert.doesNotMatch(current[3].label, /reference/i);
  assert.equal(current[1].priceUnitLabel, 'per video');
  assert.deepEqual(current.at(-1), authored.at(-1), 'maximum duration is a capability, not a price');
});

test('Seedance 2.5 preserves explicit audio and opt-in is localized in the real data builder', async () => {
  const entry = getFalEngineById('seedance-2-5')!;
  for (const [locale, modeText, audioText, unit] of [
    ['en', 'Text → Video', 'Audio on', 'per video'],
    ['fr', 'Texte → Vidéo', 'Audio activé', 'par vidéo'],
    ['es', 'Texto → Video', 'Audio activado', 'por video'],
  ] as const) {
    const calls: PublicModelQuoteInput[] = [];
    const { data } = await buildCurrentModelDecisionData(entry, locale, readModelDecisionInput(entry.modelSlug, locale),
      async input => { calls.push(input); return { status: 'exact', amountCents: 867, currency: 'USD', revision: 'current', scenarioLabel: 'current' }; });
    assert.ok(data);
    const scenario = data.pricing.scenarios.find(row => row.id === '15s-720p-audio')!;
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[1], { modelId: entry.id, mode: 't2v', durationSec: 15, resolution: '720p', audio: true });
    assert.equal(scenario.details?.audio, true);
    assert.ok(scenario.note.includes(modeText));
    assert.ok(scenario.note.includes(audioText));
    assert.equal(scenario.priceUnitLabel, unit);
  }
});

test('unavailable opted-in cards keep settings but drop stale prices and rate/audio copy', async () => {
  const entry = getFalEngineById('seedance-2-0-mini')!;
  const rows = [{ id: 'short', label: 'Short', value: '$9.99', note: '$0.19/s · audio incl.' }];
  const current = await refreshModelDecisionPricingScenarios(entry, 'fr', rows,
    [{ id: 'short', seconds: 4, resolution: '480p', labelKey: 'entryDraft' }],
    async () => ({ status: 'unavailable' }), { showScenarioDetails: true });
  assert.doesNotMatch(`${current[0].value} ${current[0].note}`, /9\.99|0\.19|audio incl/);
  assert.match(current[0].note, /4 s.*480p.*Audio désactivé/);
  assert.equal(current[0].priceUnitLabel, undefined);
});

test('other templates retain their existing presentation and quote behavior', async () => {
  const entry = getFalEngineById('pika-text-to-video')!;
  const { data } = await buildCurrentModelDecisionData(entry, 'en', readModelDecisionInput(entry.modelSlug, 'en'),
    async () => ({ status: 'exact', amountCents: 26, currency: 'USD', revision: 'current', scenarioLabel: 'current' }));
  assert.ok(data);
  assert.ok(data.pricing.scenarios.every(row => row.details === undefined && row.priceUnitLabel === undefined));
});

test('the production commercial-data path forwards the opt-in without adding quote requests', async () => {
  for (const modelId of ['seedance-2-0-mini', 'seedance-2-5']) {
    const entry = getFalEngineById(modelId)!;
    const config = getModelPageTemplateConfig(entry.modelSlug)!;
    for (const locale of ['en', 'fr', 'es'] as const) {
      const calls: PublicModelQuoteInput[] = [];
      const result = await prepareModelCommercialData({
        engine: entry, locale,
        pricing: Promise.resolve({ pricingEngine: entry.engine } as ModelPagePricing),
        templateData: buildModelDecisionDataFromContent({ engine: entry, locale }), templateConfig: config,
        quoteModel: async input => { calls.push(input); return {
          status: 'exact', amountCents: 777, currency: 'USD', revision: 'controlled', scenarioLabel: 'controlled',
        }; },
      });
      assert.ok(result.scenarios);
      assert.equal(calls.length, modelId === 'seedance-2-0-mini' ? 5 : 4, 'existing card quotes plus one public offer');
      for (const card of result.scenarios.filter(card => card.id !== 'max-duration')) {
        assert.ok(card.details, `${modelId}/${locale}: production data contains the actual scenario`);
        assert.ok(card.priceUnitLabel);
        assert.doesNotMatch(card.note, /audio incl\./);
      }
    }
  }
});
