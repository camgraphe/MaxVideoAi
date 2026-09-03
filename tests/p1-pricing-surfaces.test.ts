import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getPayAsYouGoContent,
} from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/index.ts';
import {
  buildPayAsYouGoPageData,
} from '../frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_lib/payg-page-data.ts';
import {
  buildPricingHubData,
  buildVideoPricingRowsFromEntries,
  type VideoPricePresetId,
} from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts';
import { computeConfiguredPreflight } from '../frontend/src/server/engines.ts';
import { priceCanonicalGeneration } from '../frontend/src/server/agent-api/generation-pricing.ts';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types.ts';
import { listFalEngines, type FalEngineEntry } from '../frontend/src/config/falEngines.ts';
import type { Resolution } from '../frontend/types/engines.ts';

const P1_IDS = [
  'gemini-omni-flash',
  'kling-3-turbo-pro',
  'kling-3-turbo-standard',
  'minimax-h3-max',
] as const;

const SCENARIOS = [
  { id: 'gemini-omni-flash', durationSec: 10, resolution: '720p', presetId: '10s-720p' },
  { id: 'kling-3-turbo-pro', durationSec: 8, resolution: '1080p', presetId: '8s-1080p' },
  { id: 'kling-3-turbo-standard', durationSec: 5, resolution: '720p', presetId: '5s-720p' },
  { id: 'minimax-h3-max', durationSec: 10, resolution: '768P', presetId: 'entry-route' },
] as const satisfies readonly {
  id: (typeof P1_IDS)[number];
  durationSec: number;
  resolution: Resolution;
  presetId: VideoPricePresetId;
}[];

const PAYG_PRESET_BY_ID: Record<(typeof P1_IDS)[number], VideoPricePresetId> = {
  'gemini-omni-flash': '5s-720p',
  'kling-3-turbo-pro': '8s-1080p',
  'kling-3-turbo-standard': '5s-720p',
  'minimax-h3-max': 'entry-route',
};

const entries = listFalEngines();

function publishedP1Entries(): FalEngineEntry[] {
  return entries.map((entry) => {
    if (!P1_IDS.includes(entry.id as (typeof P1_IDS)[number])) return structuredClone(entry);
    return {
      ...structuredClone(entry),
      surfaces: {
        ...structuredClone(entry.surfaces),
        modelPage: { ...entry.surfaces.modelPage, indexable: true },
        pricing: { ...entry.surfaces.pricing, includeInEstimator: true },
      },
    };
  });
}

test('P1 pricing, preflight, and MCP preparation share one canonical quote', async () => {
  const rows = buildVideoPricingRowsFromEntries(publishedP1Entries(), 'en');
  const byId = new Map(entries.map((entry) => [entry.id, entry.engine]));

  for (const scenario of SCENARIOS) {
    const engine = byId.get(scenario.id);
    assert.ok(engine, scenario.id);
    const preflight = await computeConfiguredPreflight({
      engine: scenario.id,
      mode: 't2v',
      durationSec: scenario.durationSec,
      resolution: scenario.resolution,
      fps: engine.fps[0] ?? 24,
      user: { memberTier: 'member' },
    }, { resolvedEngine: engine });
    assert.equal(preflight.ok, true, `${scenario.id}:preflight`);

    const request: CanonicalGenerationRequest = {
      schemaVersion: 1,
      surface: 'video',
      engineId: scenario.id,
      mode: 't2v',
      prompt: 'Pricing parity fixture.',
      settings: {
        durationSec: scenario.durationSec,
        resolution: scenario.resolution,
      },
      references: [],
      outputCount: 1,
    };
    const mcpQuote = await priceCanonicalGeneration(
      request,
      'member',
      undefined,
      { resolvedEngine: engine },
    );
    const pricingQuote = rows.find((row) => row.id === scenario.id)?.quotes[scenario.presetId];
    const pricingAmount = pricingQuote?.amountCents ?? pricingQuote?.closest?.amountCents;

    assert.ok(pricingQuote, `${scenario.id}:pricing-row`);
    assert.equal(mcpQuote.priceCents, preflight.total, `${scenario.id}:mcp/preflight`);
    assert.equal(pricingAmount, mcpQuote.priceCents, `${scenario.id}:pricing/mcp`);
  }
});

test('P1 PAYG cards and lookups copy localized canonical pricing rows', () => {
  const localizedPrefixes = {
    en: '/models/',
    fr: '/fr/modeles/',
    es: '/es/modelos/',
  } as const;

  for (const locale of ['en', 'fr', 'es'] as const) {
    const pricingHub = structuredClone(buildPricingHubData(locale));
    pricingHub.video.rows = buildVideoPricingRowsFromEntries(publishedP1Entries(), locale);
    const data = buildPayAsYouGoPageData({
      locale,
      content: getPayAsYouGoContent(locale),
      pricingHub,
    });

    for (const scenario of SCENARIOS) {
      const row = pricingHub.video.rows.find((candidate) => candidate.id === scenario.id);
      assert.ok(row, `${locale}:${scenario.id}:row`);
      assert.equal(row.modelHref, `${localizedPrefixes[locale]}${scenario.id}`);
      assert.ok(data.modelTesting.items.some((item) => item.id === scenario.id));
      const paygPreset = PAYG_PRESET_BY_ID[scenario.id];
      const lookup = data.priceLookups.items.find((item) => item.id === scenario.id);
      assert.equal(lookup?.price, row.quotes[paygPreset].display, `${locale}:${scenario.id}:lookup`);
      const example = data.exampleCosts.items.find((item) => item.id === scenario.id);
      assert.equal(example?.price, row.quotes[paygPreset].display, `${locale}:${scenario.id}:example`);
    }
  }
});

test('P1 PAYG content owns no copied price and never attributes H3 Max to Fal', () => {
  const source = ['en', 'fr', 'es'].map((locale) => readFileSync(
    `frontend/app/(localized)/[locale]/(marketing)/pay-as-you-go-ai-video-generator/_content/${locale}.ts`,
    'utf8',
  )).join('\n');
  assert.doesNotMatch(source, /\$(?:0|[1-9]\d*\.\d)|\b\d+(?:\.\d+)?\s*cents?\b/i);

  for (const locale of ['en', 'fr', 'es'] as const) {
    const content = getPayAsYouGoContent(locale);
    assert.doesNotMatch(JSON.stringify({
      model: content.modelTesting.models['minimax-h3-max'],
      lookup: content.priceLookups.items['minimax-h3-max'],
      example: content.exampleCosts.labels['minimax-h3-max'],
    }), /fal(?:\.ai)?/i);
  }
});
