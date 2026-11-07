import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { klingV4FlashPricingUsage } from '../frontend/src/lib/kling-v4-flash-pricing';
import { klingV4PricingUsage } from '../frontend/src/lib/kling-v4-pricing';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { canonicalKlingV4PricingFacts } from '../frontend/src/server/agent-api/generation-kling-v4-pricing-facts';
import { computeConfiguredPreflight } from '../frontend/src/server/engines';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';

function modifyRequest(durationSec?: number): CanonicalGenerationRequest {
  return {
    schemaVersion: 1, surface: 'video', engineId: 'kling-v4-flash', mode: 'v2v',
    prompt: 'Change the scenery and retain the source movement.', outputCount: 1,
    settings: { resolution: '720p', ...(durationSec === undefined ? {} : { durationSec }) },
    references: [
      { kind: 'asset', assetId: 'source', role: 'source' },
      { kind: 'asset', assetId: 'reference', role: 'reference', slot: 0 },
      { kind: 'asset', assetId: 'subject', role: 'reference', slot: 1 },
    ],
    subjects: [{ kind: 'video', referenceSlot: 1 }],
  };
}

function ownedVideos(): ResolvedReference[] {
  return [
    { assetId: 'source', role: 'source' as const, durationSec: 4.25 },
    { assetId: 'reference', role: 'reference' as const, slot: 0, durationSec: 3.5 },
    { assetId: 'subject', role: 'reference' as const, slot: 1, durationSec: 5 },
  ].map(reference => ({ ...reference, mediaKind: 'video',
    storageUrl: `https://media.example/${reference.assetId}.mp4`,
    width: 1280, height: 720, fps: 30, mimeType: 'video/mp4', sizeBytes: 1024 }));
}

const explicit = { mode: 'v2v' as const, resolution: '720p', durationSec: 5,
  hasVideoInput: true, inputVideoDurationSec: 12.75 };

test('Flash Modify uses its documented 6.3-cent input-plus-output basis with exact inherited source timing', () => {
  assert.deepEqual(klingV4FlashPricingUsage(explicit), {
    inputVideoDurationSec: 12.75, outputDurationSec: 5, hasVideoInput: true,
    billableSeconds: 17.75, centsPerSecond: 6.3, supplierExactCents: 111.825,
  });
  const inherited = klingV4FlashPricingUsage({ ...explicit, durationSec: NaN, inheritedDurationSec: 4.25 });
  assert.equal(inherited.outputDurationSec, 4.25);
  assert.equal(inherited.billableSeconds, 17);
  assert.equal(inherited.supplierExactCents, 107.1);
  assert.equal(klingV4FlashPricingUsage({ ...explicit, durationSec: 20, inputVideoDurationSec: 3 }).supplierExactCents, 252);
  assert.equal(klingV4FlashPricingUsage({ ...explicit, inputVideoDurationSec: 20, inheritedDurationSec: 16.5 }).supplierExactCents, 229.95);
});

test('Flash Modify pricing refuses missing verified input facts and out-of-domain timing', () => {
  for (const patch of [
    { hasVideoInput: undefined }, { hasVideoInput: false }, { inputVideoDurationSec: undefined },
    { inputVideoDurationSec: 20.001 }, { inputVideoDurationSec: NaN }, { inputVideoDurationSec: 2.99 },
    { durationSec: 2 }, { durationSec: 21 }, { durationSec: 3.5 }, { resolution: '1080p' },
    { inheritedDurationSec: 2.99 }, { inheritedDurationSec: 20.001 },
    { inheritedDurationSec: 13 }, { inheritedDurationSec: NaN },
  ]) assert.throws(() => klingV4FlashPricingUsage({ ...explicit, ...patch }), JSON.stringify(patch));
  assert.throws(() => klingV4FlashPricingUsage({ ...explicit, mode: 'ref2v', inheritedDurationSec: 4.25 }));
});

test('canonical Flash Modify facts inherit only the owned source while summing source, references and subjects', () => {
  const facts = canonicalKlingV4PricingFacts(modifyRequest(), ownedVideos());
  assert.deepEqual(facts, { hasVideoInput: true, inputVideoDurationSec: 12.75, inheritedDurationSec: 4.25 });
  assert.deepEqual(canonicalKlingV4PricingFacts(modifyRequest(5), ownedVideos()), {
    hasVideoInput: true, inputVideoDurationSec: 12.75,
  });
  const request = modifyRequest();
  request.settings.inputVideoDurationSec = 1;
  request.settings.inheritedDurationSec = 1;
  assert.deepEqual(canonicalKlingV4PricingFacts(request, ownedVideos()), facts, 'Caller settings cannot replace owned timing.');
  for (const references of [
    undefined, ownedVideos().slice(1), [...ownedVideos(), ownedVideos()[0]],
    ownedVideos().map((reference, index) => index === 0 ? { ...reference, durationSec: null } : reference),
    ownedVideos().map((reference, index) => index === 0 ? { ...reference, durationSec: 12 } : reference),
    ownedVideos().map((reference, index) => index === 0 ? { ...reference, mediaKind: 'image' as const } : reference),
  ]) assert.throws(() => canonicalKlingV4PricingFacts(request, references));
});

test('Flash Modify fractional output quantities select a distinct reviewed continuous tariff without altering creation selectors', () => {
  const engine = getFalEngineById('kling-v4-flash')!.engine;
  const context = { engine, ...explicit, inheritedDurationSec: 4.25 };
  const billingFacts = buildBillingPricingFacts(context, undefined, 'USD');
  const scenario = buildManualTariffScenario(context, billingFacts.facts);
  assert.deepEqual(scenario.selector, {
    engineId: 'kling-v4-flash', mode: 'v2v', resolution: '720p', durationSec: '4.25',
    inputVideoDurationSec: '12.75', billingInputType: 'video_input',
  });
  assert.deepEqual(scenario.quantities, { output_seconds: 4.25, billable_seconds: 17,
    output_units: 4.25, input_video_seconds: 12.75 });
  const continuous = continuousInputTariffSelector(scenario.selector);
  assert.deepEqual(continuous, { ...scenario.selector, durationSec: 'continuous', inputVideoDurationSec: 'continuous' });
  const creation = { engine, ...explicit, mode: 'ref2v' as const };
  const creationScenario = buildManualTariffScenario(creation, buildBillingPricingFacts(creation, undefined, 'USD').facts);
  assert.deepEqual(continuousInputTariffSelector(creationScenario.selector), {
    engineId: 'kling-v4-flash', mode: 'ref2v', resolution: '720p', durationSec: '5',
    inputVideoDurationSec: 'continuous', billingInputType: 'video_input',
  });
  assert.notDeepEqual(continuous, continuousInputTariffSelector(creationScenario.selector));
});

test('Flash Modify leaves standard Kling V4 and historical Flash creation cost quantities unchanged', () => {
  assert.equal(klingV4FlashPricingUsage({ mode: 't2v', resolution: '720p', durationSec: 5 }).supplierExactCents, 47);
  assert.equal(klingV4FlashPricingUsage({ ...explicit, mode: 'ref2v' }).supplierExactCents, 111.825);
  assert.equal(klingV4PricingUsage({ ...explicit, inputVideoDurationSec: 30.02, inheritedDurationSec: 30.02 }).supplierExactCents, 564.376);
});

test('Flash Modify preflight forwards exact inherited source seconds into the canonical quote context', async () => {
  const engine = getFalEngineById('kling-v4-flash')!.engine;
  const observed: number[] = [];
  const result = await computeConfiguredPreflight({ engine: engine.id, mode: 'v2v',
    resolution: '720p', durationSec: NaN, durationOption: 'auto', hasVideoInput: true }, {
    resolvedEngine: engine,
    trustedMediaPricingFacts: { inputVideoDurationSec: 12.75, inheritedDurationSec: 4.25 },
    computePublicSnapshot: async context => {
      observed.push(context.durationSec);
      return computeCanonicalBillingSnapshot(context, {
        pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
        loadCustomerTariffState: async () => ({ status: 'loaded', active: true, revision: 1,
          versionedCells: [], databaseCells: [{ id: 'reviewed-flash-modify', source: 'database',
            version: 1, currency: 'USD', effectiveFrom: '2026-10-01T00:00:00Z',
            selector: { engineId: engine.id, mode: 'v2v', resolution: '720p', durationSec: 'continuous',
              inputVideoDurationSec: 'continuous', billingInputType: 'video_input' },
            price: { kind: 'unit_terms', rounding: 'up', terms: [{ unit: 'billable_seconds', centsPerUnit: 15 }] } }] }),
      });
    },
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.total, 255);
  assert.deepEqual(observed, [4.25]);
});
