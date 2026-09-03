import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MINIMAX_H3_MAX_ENGINE,
  MINIMAX_H3_MAX_FAL_ENGINE_REGISTRY,
} from '../frontend/src/config/fal-engines/minimax-h3-max';
import { buildMinimaxH3MaxFalRequest } from '../frontend/src/lib/minimax-h3-max';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts';
import { getAgentModelDetails } from '../frontend/src/server/agent-api/model-details';

const endpointPattern = /minimax\/h3-max\/(?:text|image|reference)-to-video/i;
const providerPattern = /\bfal\b|fal\.ai/i;

function assertPublicSafe(value: unknown, label: string) {
  const serialized = JSON.stringify(value);
  assert.doesNotMatch(serialized, providerPattern, `${label} leaked an infrastructure provider`);
  assert.doesNotMatch(serialized, endpointPattern, `${label} leaked an endpoint ID`);
}

test('MiniMax H3 Max public engine copy and metadata use only MiniMax and Hailuo branding', () => {
  const entry = MINIMAX_H3_MAX_FAL_ENGINE_REGISTRY[0];
  assert.ok(entry);
  assertPublicSafe({
    marketingName: entry.marketingName,
    cardTitle: entry.cardTitle,
    provider: entry.provider,
    type: entry.type,
    seo: entry.seo,
    seoText: entry.seoText,
    billingNote: entry.billingNote,
    pricing: entry.engine.pricing,
    modeNotes: entry.modes.map(({ ui }) => ui.notes),
  }, 'public engine details');
});

test('MiniMax H3 Max validation and pricing metadata do not expose infrastructure routing', () => {
  let validationMessage = '';
  try {
    buildMinimaxH3MaxFalRequest({
      mode: 'i2v',
      prompt: 'Animate this frame.',
      durationSec: 5,
    });
  } catch (error) {
    validationMessage = error instanceof Error ? error.message : String(error);
  }
  assert.match(validationMessage, /start image/i);
  assertPublicSafe(validationMessage, 'validation message');

  const context = {
    engine: MINIMAX_H3_MAX_ENGINE,
    durationSec: 5,
    resolution: '768P',
    mode: 'ref2v' as const,
    verifiedReferenceTokenCount: 4_096,
  };
  assertPublicSafe(
    buildBillingPricingFacts(context, MINIMAX_H3_MAX_ENGINE.pricingDetails, 'USD').meta,
    'billing metadata',
  );
  assertPublicSafe(buildPublicPricingFacts(context).meta, 'public pricing metadata');
});

test('MiniMax H3 Max MCP details serialize no infrastructure provider or endpoint', async () => {
  const details = await getAgentModelDetails('minimax-h3-max', {
    listEngines: async () => [MINIMAX_H3_MAX_ENGINE],
    surfaceByEngineId: () => 'video',
    isEngineExecutable: () => true,
    isModeExecutable: () => true,
    getGuidance: () => null,
    getPromptingSources: () => [],
    resolveRuntimeModel: () => null,
  });

  assert.equal(details.label, 'MiniMax H3 Max');
  assertPublicSafe(details, 'MCP model details');
});
