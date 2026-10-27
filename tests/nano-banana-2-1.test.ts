import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildGoogleVertexImagePayload } from '../frontend/src/server/images/google-vertex-image-payload';
import { GoogleVertexImageClient } from '../frontend/src/server/images/google-vertex-image-client';
import { buildManualTariffScenario, continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import type { PricingContext } from '../frontend/src/lib/pricing-context';
import { normalizeGenerationRequest, hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import * as vertexResponse from '../frontend/src/server/images/google-vertex-image-response';
import { resolveImageGenerationRequestContext } from '../frontend/src/server/images/image-generation-request-context';
import { priceCanonicalGeneration, priceCanonicalGenerationWithBilling } from '../frontend/src/server/agent-api/generation-pricing';
import { parseModelDecisionContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content';
import { readFileSync } from 'node:fs';
import { prepareImagePickerOption } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-model-picker';
import { assertNano21Scenario, normalizeNano21Settings } from '../frontend/src/lib/nano-banana-2-1';
import * as coverage from '../frontend/lib/pricing-audit/manual-tariff-coverage';

test('Nano 2.1 is separately published and has only the documented image controls', () => {
  const entry = getFalEngineById('nano-banana-2-1');
  assert.ok(entry, 'new version has its own definition');
  assert.equal(entry.surfaces.app.enabled, true, 'approved model enters executable discovery');
  assert.equal(entry.engine.providerMeta?.modelSlug, 'gemini-nano-banana-2.1');
  assert.deepEqual(entry.engine.resolutions, ['1k', '2k', '4k']);
  assert.equal(entry.engine.aspectRatios.length, 14);
  const fields = [...entry.engine.inputSchema!.required, ...entry.engine.inputSchema!.optional];
  assert.deepEqual(fields.find(f => f.id === 'thinking_level')?.values, ['minimal', 'medium', 'high']);
  assert.equal(fields.find(f => f.id === 'image_urls')?.maxCount, 14);
  assert.equal(fields.find(f => f.id === 'num_images')?.max, 1);
  for (const id of ['seed', 'temperature', 'top_p', 'top_k', 'mask_url', 'output_format', 'limit_generations']) {
    assert.equal(fields.some(f => f.id === id), false, id);
  }
  assert.equal(getFalEngineById('nano-banana-2')!.engine.providerMeta?.modelSlug, 'gemini-3.1-flash-image');
  assert.ok(getFalEngineById('nano-banana-2')!.engine.resolutions.includes('0.5k'));
});

test('admin coverage exposes six fixed size/mode classes without duplicate unpriced controls', () => {
  const engine = getFalEngineById('nano-banana-2-1')!.engine;
  const text = coverage.nano21ManualTariffContexts(engine,'t2i');
  const edit = coverage.nano21ManualTariffContexts(engine,'i2i');
  assert.equal(text.length,3); assert.equal(edit.length,3);
  const scenarios = [...text,...edit].map(context=>coverage.buildManualTariffCoverageScenario(context,'nano21-fixed'));
  assert.equal(new Set(scenarios.map(scenario=>scenario.id)).size,6);
  const inventory=coverage.collectSellableManualTariffCoverage({modelId:engine.id});
  assert.equal(inventory.scenarios.length,6);
  assert.deepEqual(inventory.gaps,[],'approved unpriced options cannot remain economic coverage gaps');
});

test('Nano21 picker estimate carries the same normalized thinking value that applying it selects', () => {
  const engine = getFalEngineById('nano-banana-2-1')!.engine;
  const current = { mode: 't2i' as const, numImages: 1, resolution: '4k', aspectRatio: '1:1', quality: null,
    thinkingLevel: 'high', enableWebSearch: false, customImageWidth: '', customImageHeight: '', referenceImageCount: 0,
    selectedReferenceCount: 0, readyReferenceSizes: [] };
  const option = prepareImagePickerOption(engine, current, 'fr');
  assert.equal(option.request.thinkingLevel, 'high');
  assert.equal(option.request.thinkingLevel, option.settings.thinkingLevel);
});

test('Nano21 reference, native limits and supported search options are enforced without provider calls', () => {
  assert.equal(normalizeNano21Settings({ resolution: '4k', thinkingLevel: 'high' }).maxOutputTokens, 32768);
  for (const maxOutputTokens of [1, 32768]) assert.equal(normalizeNano21Settings({ maxOutputTokens }).maxOutputTokens, maxOutputTokens);
  for (const maxOutputTokens of [0, 1.5, 32769]) assert.throws(() => normalizeNano21Settings({ maxOutputTokens }));
  assertNano21Scenario({ mode: 't2i', referenceImageCount: 0 });
  assertNano21Scenario({ mode: 'i2i', referenceImageCount: 14 });
  assertNano21Scenario({ mode: 't2i', enableWebSearch: true, enableImageSearch: true });
  for (const input of [{ mode: 'i2i', referenceImageCount: 0 }, { mode: 'i2i', referenceImageCount: 15 },
    { mode: 't2i', referenceImageCount: 1 }, { mode: 't2i', outputCount: 2 }]) {
    assert.throws(() => assertNano21Scenario(input));
  }
});

test('an explicit Nano21 web request selects that exact live model', () => {
  assert.equal(resolveImageGenerationRequestContext({ engineId:'nano-banana-2-1',mode:'t2i',prompt:'A still' }).engineEntry.id,'nano-banana-2-1');
});

test('Nano21 preparation and transaction pricing pass the same exact settings and reference count', async () => {
  const engine = getFalEngineById('nano-banana-2-1')!.engine;
  const request = normalizeGenerationRequest({ surface: 'image', engineId: engine.id, mode: 'i2i', prompt: 'A still',
    settings: { resolution: '4k', thinkingLevel: 'high', maxOutputTokens: 8192, systemInstruction: 'Preserve geometry' },
    references: [{ kind: 'asset', role: 'reference', assetId: 'ma_' + 'a'.repeat(32) }] });
  const snapshot = { totalCents: 77, currency: 'USD', membershipTier: 'member' } as Awaited<ReturnType<typeof computeCanonicalBillingSnapshot>>;
  let estimate: Record<string, unknown> = {};
  await priceCanonicalGeneration(request, 'member', { estimateImage: async input => {
    estimate = input; return { pricing: snapshot, normalized: {} };
  } } as Parameters<typeof priceCanonicalGeneration>[2]);
  let transaction: PricingContext | undefined;
  await priceCanonicalGenerationWithBilling(request, 'member', { resolvedEngine: engine }, async context => { transaction = context; return snapshot; });
  for (const key of ['resolution', 'thinkingLevel', 'maxOutputTokens', 'systemInstruction', 'referenceImageCount']) {
    assert.equal(estimate[key], transaction![key as keyof PricingContext], key);
  }
  assert.equal(transaction!.referenceImageCount, 1);
  const payload = buildGoogleVertexImagePayload({ ...transaction!, modelId: 'gemini-nano-banana-2.1', prompt: request.prompt,
    imageSize: transaction!.resolution });
  assert.equal(payload.generationConfig.thinkingConfig?.thinkingLevel, 'HIGH');
  assert.equal(payload.generationConfig.maxOutputTokens, 8192);
});

test('staged localized pages contain strict factual decision content and no trial media', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const source = readFileSync(`content/models/${locale}/nano-banana-2-1.json`, 'utf8');
    const content = JSON.parse(source);
    assert.equal(parseModelDecisionContent(content.decision, 'nano-banana-2-1', locale).modelSlug, 'nano-banana-2-1');
    assert.doesNotMatch(source, /https:\/\/media\.|0\.5K|seed.*(?:reuse|réutilis|reutiliz)|qualityScore/i);
  }
});

test('canonical Nano settings bind defaults, normalize aliases and retain owned reference order', () => {
  const input = { surface: 'image', engineId: 'nano-banana-2-1', mode: 'i2i', prompt: 'A still',
    settings: { resolution: '2K', thinkingLevel: 'HIGH', maxOutputTokens: 4096, systemInstruction: 'Keep the subject' },
    references: [{ kind: 'asset', role: 'reference', assetId: 'ma_' + 'b'.repeat(32) },
      { kind: 'asset', role: 'reference', assetId: 'ma_' + 'a'.repeat(32) }] };
  const normalized = normalizeGenerationRequest(input);
  assert.equal(normalized.settings.resolution, '2k');
  assert.equal(normalized.settings.thinkingLevel, 'high');
  assert.equal(normalized.settings.enableWebSearch, false);
  assert.equal(normalized.settings.enableImageSearch, false);
  assert.deepEqual(normalizeGenerationRequest(normalized), normalized);
  assert.equal(normalized.references[0].kind === 'asset' && normalized.references[0].assetId, input.references[0].assetId);
  assert.equal(hashCanonicalGenerationRequest(normalized), hashCanonicalGenerationRequest({ ...normalized,
    settings: { ...normalized.settings, thinkingLevel: 'HIGH', resolution: '2K' } }));
  for (const settings of [{ thinkingLevel: 'low' }, { resolution: '0.5k' }, { seed: 3 }, { maxOutputTokens: 32769 }]) {
    assert.throws(() => normalizeGenerationRequest({ ...input, settings }));
  }
  assert.throws(() => normalizeGenerationRequest({ ...input, references: [{ kind: 'https', role: 'reference', url: 'https://media.maxvideoai.com/example.png' }] }));
});

test('Nano tariff cannot fall through inactive pricing or another version; exact cells retain their revision', async () => {
  const engine = getFalEngineById('nano-banana-2-1')!.engine;
  const context = { engine, mode: 't2i' as const, durationSec: 1, resolution: '1k', thinkingLevel: 'high', referenceImageCount: 0 };
  const selector = buildManualTariffScenario(context, buildBillingPricingFacts(context, undefined, 'USD').facts).selector;
  const cell = { id: 'synthetic-nano21-only', source: 'database' as const, version: 3, currency: 'USD',
    effectiveFrom: '2026-10-25T00:00:00Z', selector, price: { kind: 'fixed' as const, customerCents: 77 } };
  const policy = { loadOverrides: async () => ({ status: 'loaded' as const, rules: [] }) };
  const quote = (active: boolean, databaseCells = [cell]) => computeCanonicalBillingSnapshot(context,
    { pricingPolicy: policy, loadCustomerTariffState: async () => ({ status: 'loaded', active, revision: 23, versionedCells: [], databaseCells }) });
  await assert.rejects(quote(false), /active reviewed Nano/);
  await assert.rejects(quote(true, []));
  await assert.rejects(quote(true, [{ ...cell, selector: { ...selector, engineId: 'nano-banana-2' } }]));
  const snapshot = await quote(true);
  assert.equal(snapshot.totalCents, 77);
  assert.equal(snapshot.meta?.customerTariffRevision, 23);
  assert.equal(snapshot.meta?.customerTariffCellId, cell.id);
});

test('Vertex modality usage counts thoughts once and never infers paid output count from inline parts', () => {
  const parse = (vertexResponse as unknown as Record<string, unknown>).parseGoogleVertexImageUsage;
  assert.equal(typeof parse, 'function');
  const usage = (parse as (value: unknown) => unknown)({ usageMetadata: { promptTokenCount: 127,
    candidatesTokenCount: 1176, thoughtsTokenCount: 1198, totalTokenCount: 2501,
    candidatesTokensDetails: [{ modality: 'TEXT', tokenCount: 56 }, { modality: 'IMAGE', tokenCount: 1120 }] } });
  assert.deepEqual(usage, { inputTokens: 127, outputTextTokens: 56, outputImageTokens: 1120, thoughtsTokens: 1198,
    listEstimateUsd: 0.0431955, invoiceCostUsd: null, source: 'google-vertex-usage-metadata', ratesCheckedAt: '2026-10-25', toolFeesIncluded: false });
  assert.equal((parse as (value: unknown) => unknown)({ candidates: [] }), null);
});

test('Nano 2.1 payload forwards explicit reasoning, budget and system instruction with ordered references', () => {
  const payload = buildGoogleVertexImagePayload({ modelId: 'gemini-nano-banana-2.1', prompt: 'A still',
    referenceImages: [{ data: 'YQ==', mimeType: 'image/png' }, { fileUri: 'gs://owned/b', mimeType: 'image/jpeg' }],
    imageSize: '4k', aspectRatio: '1:8', thinkingLevel: 'high', maxOutputTokens: 32768,
    systemInstruction: 'Keep the product shape.', enableWebSearch: true, enableImageSearch: true,
  } as Parameters<typeof buildGoogleVertexImagePayload>[0]);
  assert.deepEqual(payload.generationConfig, { responseModalities: ['TEXT', 'IMAGE'], candidateCount: 1,
    maxOutputTokens: 32768, thinkingConfig: { thinkingLevel: 'HIGH' }, imageConfig: { aspectRatio: '1:8', imageSize: '4K' } });
  assert.deepEqual((payload as unknown as Record<string, unknown>).systemInstruction, { parts: [{ text: 'Keep the product shape.' }] });
  assert.deepEqual(payload.tools, [{ googleSearch: { searchTypes: { webSearch: {}, imageSearch: {} } } }]);
  assert.equal(payload.contents[0].parts[1].inlineData?.data, 'YQ==');
  assert.equal(payload.contents[0].parts[2].fileData?.fileUri, 'gs://owned/b');
});

test('Nano 2.1 fixes only its request region to global and never retries an ambiguous empty result', async () => {
  const urls: string[] = [];
  const client = new GoogleVertexImageClient({ projectId: 'existing', location: 'europe-west4',
    apiBaseUrl: 'https://europe-west4-aiplatform.googleapis.com', serviceAccount: { client_email: 'test@example.com', private_key: 'unused' },
    getAccessTokenFn: async () => 'test', retryDelayMs: 0,
    fetchFn: async url => { urls.push(String(url)); return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'No image' }] } }] })); } });
  const payload = buildGoogleVertexImagePayload({ prompt: 'A still' });
  await client.generateContent('gemini-nano-banana-2.1', payload);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /^https:\/\/aiplatform.googleapis.com\//);
  assert.match(urls[0], /\/locations\/global\//);
  urls.length = 0;
  await client.generateContent('gemini-3.1-flash-image', payload);
  assert.equal(urls.length, 2);
  assert.match(urls[0], /\/locations\/europe-west4\//);
});

test('Nano21 fixed tariff identity contains exactly the priced size and mode', () => {
  const context = {engine:{id:'nano-banana-2-1'},mode:'t2i',resolution:'1k',durationSec:1,
    referenceImageCount:0,thinkingLevel:'high',maxOutputTokens:4096,aspectRatio:'16:9'} as PricingContext;
  const facts = {engineId:context.engine.id,currency:'USD',vendorSubtotalExactCents:0,quantity:1,unit:'image' as const};
  const scenario = buildManualTariffScenario(context,facts);
  assert.deepEqual(scenario.selector,{engineId:'nano-banana-2-1',mode:'t2i',resolution:'1K',durationSec:'1'});
  assert.equal(continuousInputTariffSelector(scenario.selector),null);
  assert.deepEqual(scenario.selector,buildManualTariffScenario({...context,thinkingLevel:'minimal',maxOutputTokens:32768,aspectRatio:'21:9'},facts).selector);
});
