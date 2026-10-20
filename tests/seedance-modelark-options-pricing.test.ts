import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { buildGenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
import { getBytePlusSeedanceModeResolutions } from '../frontend/lib/byteplus-mode-capabilities';
import { normalizeBytePlusOptions } from '../frontend/app/api/generate/_lib/request-options-byteplus';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import { quotePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { priceCanonicalGeneration } from '../frontend/src/server/agent-api/generation-pricing';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import type { PricingContext } from '../frontend/src/lib/pricing-context';

const aspects = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'];
const engine = (id = 'seedance-2-0') => getFalEngineById(id)!.engine;
const policy = { loadOverrides: async () => ({ status: 'loaded' as const, rules: [] }) };
function state(context: PricingContext) {
  return { status: 'loaded' as const, active: true, revision: 17, databaseCells: [], versionedCells: aspects.map((aspectRatio, index) => {
    const fixed = { ...context, durationOption: undefined, aspectRatio };
    return { id: `aspect-${aspectRatio}`, selector: buildManualTariffScenario(fixed,
      buildBillingPricingFacts(fixed, fixed.engine.pricingDetails, 'USD').facts).selector,
      source: 'versioned' as const, version: 1, currency: 'USD', effectiveFrom: '2026-01-01T00:00:00Z',
      price: { kind: 'fixed' as const, customerCents: aspectRatio === '1:1' ? 5500 : 5000 + index } };
  }) };
}

test('Seedance Auto requests retain provider intent and cannot reduce the positive pricing maximum', () => {
  for (const [modelId, maximum] of [['seedance-2-0', 15], ['seedance-2-0-fast', 15], ['seedance-2-0-mini', 15], ['seedance-2-5', 30]] as const) {
    for (const durationSec of [4, maximum]) {
      const result = buildGenerateRequestOptions({ engine: engine(modelId), mode: 't2v', isBytePlusV1a: true,
        body: { durationSec, durationOption: 'auto', resolution: '480p', aspectRatio: 'auto' } });
      assert.ok(result.ok, JSON.stringify(result));
      assert.equal(result.options.durationSec, maximum, modelId);
      assert.equal(result.options.rawDurationOption, 'auto');
      assert.equal(result.options.aspectRatio, 'auto');
    }
  }
});

test('canonical Seedance factual quantities use the Auto maximum instead of a caller numeric hint', () => {
  for (const [modelId, maximum] of [['seedance-2-0', 15], ['seedance-2-0-fast', 15], ['seedance-2-0-mini', 15], ['seedance-2-5', 30]] as const) {
    const context = { engine: engine(modelId), mode: 't2v' as const, resolution: '480p', aspectRatio: '16:9',
      durationSec: 4, durationOption: 'auto', hasVideoInput: false };
    const facts = buildBillingPricingFacts(context, context.engine.pricingDetails, 'USD').facts;
    assert.equal(facts.quantity, maximum, modelId);
    assert.equal(buildManualTariffScenario(context, facts).selector.durationSec, String(maximum));
  }
});

test('adaptive fixed-price quotes select the highest current authored amount rather than a default raster', async () => {
  const context = { engine: engine(), mode: 't2v' as const, resolution: '480p', aspectRatio: 'auto',
    durationSec: 4, durationOption: 'auto', hasVideoInput: false };
  const tariffs = state({ ...context, durationSec: 15 });
  const quote = await computeCanonicalBillingSnapshot(context, { pricingPolicy: policy, loadCustomerTariffState: async () => tariffs });
  assert.equal(quote.totalCents, 5500);
  assert.equal(quote.meta?.customerTariffCellId, 'aspect-1:1');
  assert.deepEqual(quote.meta?.seedanceAutomaticPricing, { durationRange: { min: 4, max: 15 }, billedDurationSec: 15,
    requestedAspectRatio: 'auto', pricingAspectRatio: '1:1', aspectPolicy: 'highest_current_tariff', fixedPrice: true });
  const fixed = await computeCanonicalBillingSnapshot({ ...context, durationSec: 15, durationOption: undefined, aspectRatio: '16:9' },
    { pricingPolicy: policy, loadCustomerTariffState: async () => tariffs });
  assert.equal(fixed.totalCents, 5001, 'Existing fixed options keep their exact tariff');
  assert.equal(fixed.meta?.seedanceAutomaticPricing, undefined);
});

test('adaptive pricing refuses a partially covered ratio domain', async () => {
  const context = { engine: engine(), mode: 't2v' as const, resolution: '480p', aspectRatio: 'auto', durationSec: 5, hasVideoInput: false };
  const tariffs = state(context);
  tariffs.versionedCells = tariffs.versionedCells.filter(cell => cell.selector.aspectRatio !== '9:16');
  await assert.rejects(computeCanonicalBillingSnapshot(context, { pricingPolicy: policy, loadCustomerTariffState: async () => tariffs }),
    error => (error as { code?: string }).code === 'missing_cell');
});

test('ModelArk 1080p Edit admission retains the narrower LAS resolution contract', () => {
  assert.deepEqual(getBytePlusSeedanceModeResolutions('seedance-2-5', 'v2v', ['480p', '720p', '1080p'], 'modelark'), ['480p', '720p', '1080p']);
  assert.deepEqual(getBytePlusSeedanceModeResolutions('seedance-2-5', 'v2v', ['480p', '720p', '1080p'], 'las'), ['480p', '720p']);
});

test('public factual and scenario quotes disclose the same Auto maximum', async () => {
  const context = { engine: engine(), mode: 't2v' as const, resolution: '480p', aspectRatio: '16:9', durationSec: 4, durationOption: 'auto', hasVideoInput: false };
  assert.equal(buildPublicPricingFacts(context).facts.quantity, 15);
  const tariffs = state({ ...context, durationSec: 15 });
  const quoted = await quotePublicModelScenario({ modelId: context.engine.id, mode: 't2v', resolution: '480p', aspectRatio: '16:9', durationSec: 4, durationOption: 'auto' },
    scenario => computeCanonicalBillingSnapshot(scenario.context, { pricingPolicy: policy, loadCustomerTariffState: async () => tariffs }));
  assert.equal(quoted.status, 'exact');
  if (quoted.status === 'exact') {
    assert.equal(quoted.amountCents, 5001);
    assert.match(quoted.scenarioLabel, /Auto.*4.*15.*15s price/i);
  }
});

test('adaptive image preflight prices verified first-frame framing and rejects unsupported source formats', async () => {
  for (const [width, height, success] of [[1080, 1920, true], [1200, 1000, false]] as const) {
    let calculated: unknown;
    const response = await resolveMediaAwarePreflight({ userId: 'owner', request: {
      engine: engine().id, mode: 'i2v', resolution: '480p', aspectRatio: 'auto', durationSec: 4, durationOption: 'auto', fps: 24,
      inputs: [{ kind: 'image', assetId: 'first', slotId: 'image_url', url: 'https://media.example.test/source.jpg' }],
    } }, {
      getConfiguredEngineFn: async () => engine(),
      processAttachmentsFn: async () => ({ ok: true, attachments: [], trustedDurationSecByField: {},
        trustedMediaReferences: [{ kind: 'image', url: 'https://media.example.test/source.jpg', width, height }],
        references: { normalizedReferenceImages: [], videoUrls: [] } }) as never,
      computeConfiguredPreflightFn: async (request, options) => { calculated = { request, options }; return { ok: true, messages: [] }; },
    });
    assert.equal(response.ok, success, JSON.stringify(response));
    if (success) {
      assert.equal((calculated as { request: { durationSec: number } }).request.durationSec, 15);
      assert.equal((calculated as { options: { trustedMediaPricingFacts: { seedanceSourceAspectRatio: string } } }).options.trustedMediaPricingFacts.seedanceSourceAspectRatio, '9:16');
    } else assert.equal(calculated, undefined);
  }
});

test('MCP prepared Auto pricing forwards intent to the same canonical maximum', async () => {
  const request = normalizeGenerationRequest({ schemaVersion: 1, surface: 'video', engineId: engine().id, mode: 't2v',
    prompt: 'A red kite flying', settings: { resolution: '480p', aspectRatio: '16:9', durationSec: 4, durationOption: 'auto' }, references: [], outputCount: 1 });
  const tariffs = state({ engine: engine(), mode: 't2v', resolution: '480p', aspectRatio: '16:9', durationSec: 15, hasVideoInput: false });
  const quote = await priceCanonicalGeneration(request, 'standard', {
    computeVideoPreflight: async parsed => {
      const pricing = await computeCanonicalBillingSnapshot({ ...parsed, engine: engine(), resolution: '480p' },
        { pricingPolicy: policy, loadCustomerTariffState: async () => tariffs });
      return { ok: true, messages: [], pricing, total: pricing.totalCents, currency: pricing.currency };
    }, estimateImage: async () => { throw new Error('Unexpected image quote'); },
  }, { resolvedEngine: engine() });
  assert.equal(quote.priceCents, 5001);
  assert.equal((quote.pricingSnapshot.meta as Record<string, unknown>).seedanceAutomaticPricing !== undefined, true);
});

test('MCP Auto tags cannot enable an unsupported provider duration policy', () => {
  const entry = getFalEngineById('wan-3')!;
  const request = normalizeGenerationRequest({ surface: 'video', engineId: entry.engine.id, mode: 't2v', prompt: 'A red kite flying',
    settings: { resolution: '480p', aspectRatio: '16:9', durationSec: 5, durationOption: 'auto' }, references: [], outputCount: 1 });
  assert.throws(() => validateCanonicalGenerationCapabilities(request, { engine: entry.engine, surface: 'video', publicModes: ['t2v'],
    modeCaps: { t2v: entry.modes.find(mode => mode.mode === 't2v')!.ui } }),
  error => (error as { field?: string }).field === 'durationOption');
});

test('legacy Seedance routes cannot submit Auto without a reviewed positive pricing maximum', () => {
  const normalized = normalizeBytePlusOptions({ engineId: 'seedance-1-5-pro', mode: 't2v', durationSec: 4,
    durationOption: 'auto', requestedResolution: '480p', aspectRatio: '16:9' });
  assert.equal(normalized.ok, false);
});

test('source-timed Edit keeps its exact inherited timing bracket ahead of an Auto hint', () => {
  const selected = engine('seedance-2-5');
  const facts = buildBillingPricingFacts({ engine: selected, mode: 'v2v', durationSec: 4, durationOption: 'auto',
    resolution: '1080p', aspectRatio: 'auto', hasVideoInput: true, inputVideoDurationSec: 4.25,
    seedanceEditSource: { durationSec: 4.25, width: 1280, height: 720, billedDurationSec: 5, pricingAspectRatio: '16:9',
      outputDuration: 'source', outputAspectRatio: 'source' } }, selected.pricingDetails, 'USD').facts;
  assert.equal(facts.quantity, 5);
  assert.equal(facts.metadata?.manualTariffAspectRatio, '16:9');
});
