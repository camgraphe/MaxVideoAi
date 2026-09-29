import assert from 'node:assert/strict';
import test from 'node:test';

import { getFalEngineById } from '../frontend/src/config/falEngines';
import { refreshModelDecisionPricingScenarios } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/current-model-decision-pricing';

test('model decision cards replace old amounts with the current exact quote', async () => {
  const entry = getFalEngineById('pika-text-to-video')!;
  const scenarios = [{ id: 'preview', label: 'Preview', value: '$0.01', note: '5s' }];
  const current = await refreshModelDecisionPricingScenarios(entry, 'en', scenarios,
    [{ id: 'preview', seconds: 5, resolution: '720p', labelKey: 'standardPreview' }],
    async () => ({ status: 'exact', amountCents: 432, currency: 'USD', revision: 'r1', scenarioLabel: 'current' }));
  assert.equal(current[0].value, '$4.32');
});

test('unavailable and multi-image decision quotes never retain an old amount', async () => {
  const entry = getFalEngineById('nano-banana-pro')!;
  const scenarios = [{ id: 'batch', label: 'Batch', value: '$0.24', note: '4 images · $0.06/image' }];
  const current = await refreshModelDecisionPricingScenarios(entry, 'en', scenarios,
    [{ id: 'batch', imageResolution: '2k', quantity: 4, labelKey: 'imageBatch' }],
    async () => { throw new Error('bulk image price must not use a single-image quote'); });
  assert.doesNotMatch(`${current[0].value} ${current[0].note}`, /\$0\.24|\$0\.06/);
});
