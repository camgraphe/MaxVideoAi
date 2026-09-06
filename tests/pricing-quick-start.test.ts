import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildPricingHubData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData';
import { projectAllowedAnalyticsPayload } from '../frontend/lib/analytics/journey';

test('featured pricing scenarios retain the exact eligible matrix quote and destination in every locale', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const { video } = buildPricingHubData(locale);
    const featured = video.highlights.filter((item) => item.featured);
    assert.equal(featured.length, 3);
    for (const item of featured) {
      const row = video.rows.find((candidate) => `#${candidate.anchorId}` === item.href);
      assert.ok(row?.highlightEligible, 'featured links must resolve to a currently eligible matrix row');
      assert.equal(item.featured!.engineName, row.engineName);
      assert.ok(Object.values(row.quotes).some((quote) => quote.status === 'exact' && quote.display === item.featured!.price));
      assert.equal(item.value, `${row.engineName} · ${item.featured!.price}`);
    }
  }
});

test('quick start is server-rendered presentation of the pricing hub, with no additional price owner', () => {
  const source = readFileSync('frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingQuickStart.tsx', 'utf8');
  assert.doesNotMatch(source, /use client|useEffect|useState|quotePublic|fetch\(|amountCents/);
  assert.match(source, /import type \{ VideoPricingHighlight \}/);
  assert.match(source, /prefetch=\{false\}/);
});

test('pricing scenario clicks retain their bounded attribution without collecting free text', () => {
  assert.deepEqual(projectAllowedAnalyticsPayload('cta_click', {
    cta_name: 'pricing_scenario', cta_location: 'pricing_hero', target_family: 'pricing',
    prompt: 'private customer text',
  }), { cta_name: 'pricing_scenario', cta_location: 'pricing_hero', target_family: 'pricing' });
});
