import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';

import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildCurrentModelDecisionData } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/current-model-decision-pricing';
import { ModelDecisionPricingCard } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelDecisionPricingCard';
import { readModelDecisionInput } from './helpers/model-decision-content';

// Next compiles JSX automatically; the direct tsx harness uses the classic runtime.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

for (const locale of ['en', 'fr', 'es'] as const) {
  test(`each rendered Mini/Seedance card binds the returned total and scenario in ${locale}`, async () => {
    for (const modelId of ['seedance-2-0-mini', 'seedance-2-5']) {
      const entry = getFalEngineById(modelId)!;
      const { data } = await buildCurrentModelDecisionData(entry, locale, readModelDecisionInput(entry.modelSlug, locale),
        async () => ({ status: 'exact', amountCents: 777, currency: 'USD', revision: 'controlled', scenarioLabel: 'controlled' }));
      assert.ok(data);
      const html = renderToStaticMarkup(React.createElement(NextIntlClientProvider, { locale, messages: {},
        children: React.createElement(ModelDecisionPricingCard, { pricing: data.pricing, locale }) }));
      const dom = new JSDOM(html);
      const cards = [...dom.window.document.querySelectorAll('article')];
      assert.equal(cards.length, data.pricing.scenarios.length);
      for (const [index, scenario] of data.pricing.scenarios.entries()) {
        const text = cards[index].textContent!;
        assert.ok(text.includes(scenario.value), `${modelId}: returned amount/capability retained`);
        if (scenario.details) {
          assert.ok(text.includes(scenario.note), `${modelId}: full scenario stays with its price`);
          assert.ok(text.includes(scenario.priceUnitLabel!), `${modelId}: price is explicitly per video`);
          assert.doesNotMatch(text, /audio incl\.|\$0\.19\/s|\$10/);
        } else {
          assert.doesNotMatch(text, /per video|par vidéo|por video/, 'capability is not a monetary card');
        }
      }
      dom.window.close();
    }
  });
}
