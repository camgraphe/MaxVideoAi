import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGenerationRequest, hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { resolveVideoOperationEngine } from '../frontend/lib/video-operation';
import { getFalEngineById } from '../frontend/src/config/falEngines';
const request = { surface: 'video', engineId: 'kling-o3-standard', mode: 'v2v', prompt: 'Change the lighting', settings: {}, references: [] };
test('operations are explicit, strict and preserve absent-operation normalization', () => {
 const legacy = normalizeGenerationRequest(request);
 assert.equal(Object.hasOwn(legacy, 'operation'), false);
 const reference = normalizeGenerationRequest({ ...request, operation: 'kling-reference' });
 const edit = normalizeGenerationRequest({ ...request, operation: 'kling-edit' });
 assert.equal(edit.operation, 'kling-edit');
 assert.notEqual(hashCanonicalGenerationRequest(edit), hashCanonicalGenerationRequest(reference));
 for (const overrides of [{ operation: 'edit' }, { operation: null }, { operation: 'kling-edit', engineId: 'seedance-2-5' }, { operation: 'kling-edit', mode: 'extend' }]) {
  assert.throws(() => normalizeGenerationRequest({ ...request, ...overrides }), /operation/i);
 }
});
test('Edit has a complete source-timed schema; Reference retains requested controls', () => {
 for (const id of ['kling-o3-standard', 'kling-o3-pro', 'kling-o3-4k']) {
  const engine = getFalEngineById(id)!.engine;
  const edit = resolveVideoOperationEngine(engine, 'v2v', 'kling-edit');
  const fields = [...edit.inputSchema!.required, ...edit.inputSchema!.optional];
  assert.equal(fields.some(f => ['duration', 'aspect_ratio', 'generate_audio'].includes(f.id)), false);
  assert.equal(edit.modeCaps?.v2v?.durationPolicy, 'source_video');
  assert.equal(fields.find(f => f.id === 'video_url')?.maxDurationSec, 15);
  assert.equal(resolveVideoOperationEngine(engine, 'v2v'), engine);
 }
});

import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import { resolveVideoProviderRoutingPlan } from '../frontend/src/server/video-providers/router';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { projectAgentModelModeDetails } from '../frontend/src/server/agent-api/model-details';

test('real Edit builders use fal endpoint and omit requested timing, ratio and fixed resolution', () => {
 for (const engineId of ['kling-o3-standard', 'kling-o3-pro', 'kling-o3-4k']) {
  const result = buildFalGenerationRequest({ engineId, mode: 'v2v', operation: 'kling-edit', prompt: 'Edit',
   videoUrl: 'https://example.com/source.mp4', durationSec: 9, aspectRatio: '9:16', resolution: '1080p',
   extraInputValues: { keep_audio: false } }, 'wrong/reference');
  assert.match(result.model, /video-to-video\/edit$/);
  for (const key of ['duration', 'aspect_ratio', 'resolution', 'generate_audio']) assert.equal(key in result.requestBody, false, key);
  assert.equal(result.requestBody.video_url, 'https://example.com/source.mp4');
  assert.equal(result.requestBody.keep_audio, false);
  for (const isAdmin of [false, true]) assert.equal(resolveVideoProviderRoutingPlan({ engineId, mode: 'v2v', operation: 'kling-edit', isAdmin,
   env: { KLING_DIRECT_ENABLED: 'true', KLING_DIRECT_PUBLIC_ROUTING_ENABLED: 'true' } }).kind, 'fal_only');
 }
});
test('real tariff selector preserves Reference and separates new endpoints', () => {
 const engine = getFalEngineById('kling-o3-standard')!.engine;
 const context = { engine, mode: 'v2v' as const, resolution: '720p', durationSec: 5 };
 const facts = { engineId: engine.id, currency: 'USD', unit: 'sec' as const, quantity: 5, vendorSubtotalExactCents: 63 };
 const legacy = buildManualTariffScenario(context, facts).selector;
 assert.deepEqual(buildManualTariffScenario({ ...context, operation: 'kling-reference' }, facts).selector, legacy);
 const edit = buildManualTariffScenario({ ...context, operation: 'kling-edit' }, facts).selector;
 assert.equal(edit.operation, 'kling-edit'); assert.equal(edit.transport, 'fal'); assert.match(edit.endpoint, /\/edit$/);
 assert.notDeepEqual(edit, legacy);
});
test('canonical validation and discovery use operation schema rather than old v2v controls', () => {
 const engine = getFalEngineById('kling-o3-standard')!.engine;
 const candidate = { engine, surface: 'video' as const, publicModes: ['v2v'] as const, modeCaps: engine.modeCaps! };
 const input = normalizeGenerationRequest({ ...request, operation: 'kling-edit', settings: { resolution: '720p', keepAudio: true }, references: [{ kind: 'asset', assetId: 'source', role: 'source' }] });
 assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(input, candidate));
 for (const settings of [{ durationSec: 5 }, { aspectRatio: '16:9' }, { audio: true }]) {
  assert.throws(() => validateCanonicalGenerationCapabilities({ ...input, settings: { ...input.settings, ...settings } }, candidate));
 }
 const edit = projectAgentModelModeDetails(candidate, 'v2v').operations!.find(op => op.operation === 'kling-edit')!;
 assert.equal(edit.durationPolicy, 'source_video'); assert.deepEqual(edit.aspectRatios, []);
 assert.ok(edit.settings.some(setting => setting.key === 'keepAudio'));
});

import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { resolveCustomerTariffQuote } from '../frontend/server/pricing/resolve-customer-tariff';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { prepareKlingOperationTariffProposal } from '../frontend/server/pricing/kling-operation-tariff-proposal';
import { canonicalOperationSourceDuration, generationOperationQuoteBinding } from '../frontend/src/server/agent-api/generation-operation-facts';

test('fractional source timing and exact operation tariffs cannot alias Reference or inactive legacy policy', async () => {
 const engine = resolveVideoOperationEngine(getFalEngineById('kling-o3-standard')!.engine, 'v2v', 'kling-edit');
 const context = { engine, mode: 'v2v' as const, operation: 'kling-edit' as const, durationSec: 5.25, resolution: '720p' };
 const facts = buildBillingPricingFacts(context, engine.pricingDetails, 'USD');
 assert.equal(facts.facts.quantity, 5.25);
 assert.equal(facts.facts.vendorSubtotalExactCents, 5.25 * 12.6);
 assert.equal(facts.meta.effective_supplier_charge_verified, false);
 const scenario = buildManualTariffScenario(context, facts.facts);
 const selector = continuousInputTariffSelector(scenario.selector)!;
 assert.equal(selector.durationSec, 'continuous');
 const state = { status: 'loaded' as const, active: true, revision: 1, versionedCells: [], databaseCells: [] };
 assert.throws(() => resolveCustomerTariffQuote({ context, facts: facts.facts, at: '2026-10-24T00:00:00Z', state }), /No active manual tariff/);
 await assert.rejects(() => computeCanonicalBillingSnapshot(context, {
  pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
  loadCustomerTariffState: async () => ({ ...state, active: false }),
 }), /separate active reviewed video operation tariff/);
 const proposal = prepareKlingOperationTariffProposal(state);
 assert.equal(proposal.proposals.length, 16);
 assert.equal(proposal.writes, false);
 assert.ok(proposal.proposals.every(item => item.customerPrice === null && !item.activationReady));
 assert.equal(new Set(proposal.proposals.map(item => JSON.stringify(item.selector))).size, 16);
});
test('owned source facts and framing are bound without rounding or accepting caller lengths', () => {
 const input = normalizeGenerationRequest({ ...request, operation: 'kling-edit', references: [{ kind: 'asset', assetId: 'source', role: 'source' }] });
 const refs = [{ assetId: 'source', role: 'source' as const, mediaKind: 'video' as const, storageUrl: 'https://example.test/source.mp4', durationSec: 5.25, width: 1280, height: 720 }];
 assert.equal(canonicalOperationSourceDuration(input, refs), 5.25);
 assert.notDeepEqual(generationOperationQuoteBinding(input, refs), generationOperationQuoteBinding(input, [{ ...refs[0]!, width: 720, height: 1280 }]));
 assert.throws(() => canonicalOperationSourceDuration(input, [{ ...refs[0]!, assetId: 'other' }]));
 for (const seconds of [2.99, 15.01, NaN]) assert.throws(() => canonicalOperationSourceDuration(input, [{ ...refs[0]!, durationSec: seconds }]));
 assert.deepEqual(generationOperationQuoteBinding(normalizeGenerationRequest(request), []), {});
});

import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import { deriveGenerationAttachmentReferences } from '../frontend/app/api/generate/_lib/attachment-references';
test('Site preflight replaces the placeholder with owned exact timing and rejects stale operations', async () => {
 const engine = getFalEngineById('kling-o3-standard')!.engine;
 const request = { engine: engine.id, mode: 'v2v' as const, operation: 'kling-edit' as const, durationSec: 9,
  resolution: '720p' as const, inputs: [{ assetId: 'source', kind: 'video' as const, slotId: 'video_url', url: 'https://example.test/source.mp4' }] };
 let duration: number | undefined;
 const dependencies = { getConfiguredEngineFn: async () => engine,
  processAttachmentsFn: async () => ({ ok: true as const, attachments: [], references: deriveGenerationAttachmentReferences({ engineId: engine.id, mode: 'v2v', attachments: [] }),
   trustedDurationSecByField: { video_url: [5.25] }, trustedMediaReferences: [{ kind: 'video' as const, fieldId: 'video_url', url: request.inputs[0]!.url, durationSec: 5.25, width: 1280, height: 720 }] }),
  computeConfiguredPreflightFn: async (input: typeof request) => { duration = input.durationSec; assert.equal(input.operation, 'kling-edit'); return { ok: true, total: 123, messages: [] }; } };
 const result = await resolveMediaAwarePreflight({ request, userId: 'owner' }, dependencies);
 assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(duration, 5.25);
 const stale = await resolveMediaAwarePreflight({ request: { ...request, mode: 't2v' }, userId: 'owner' }, dependencies);
 assert.equal(stale.ok, false);
});

import { buildGenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
test('API options reject unknown operation and stale Edit controls before submission', () => {
 const engine = getFalEngineById('kling-o3-standard')!.engine;
 for (const body of [{ operation: 'unknown' }, { operation: 'kling-edit', durationSec: 5 }, { operation: 'kling-edit', aspectRatio: '9:16' }]) {
  assert.equal(buildGenerateRequestOptions({ body, engine, mode: 'v2v', isBytePlusV1a: false }).ok, false);
 }
 const result = buildGenerateRequestOptions({ body: { operation: 'kling-edit', prompt: 'Edit', resolution: '720p' }, engine, mode: 'v2v', isBytePlusV1a: false });
 assert.equal(result.ok, true);
 if (result.ok) { assert.equal(result.options.supportsDuration, false); assert.equal(result.options.supportsAspectRatio, false); }
});

test('proposal selectors cover actual canonical Element and Site guidance/orientation pricing contexts', async () => {
 const {priceCanonicalGenerationWithBilling}=await import('../frontend/src/server/agent-api/generation-pricing');
 const {computeConfiguredPreflight}=await import('../frontend/src/server/engines');
 const state={status:'loaded' as const,active:true,revision:1,versionedCells:[],databaseCells:[]};
 const proposal=prepareKlingOperationTariffProposal(state);
 const verify=(context:import('../frontend/src/lib/pricing-context').PricingContext)=>{
  const facts=buildBillingPricingFacts(context,context.engine.pricingDetails,'USD').facts;
  const exact=buildManualTariffScenario(context,facts).selector;
  const selector=continuousInputTariffSelector(exact)??exact;
  assert.ok(proposal.proposals.some(item=>JSON.stringify(item.selector)===JSON.stringify(selector)),JSON.stringify(selector));
  assert.equal(selector.aspectRatio,undefined);assert.equal(selector.referenceImageCount,undefined);
  return {totalCents:100,currency:'USD',membershipTier:'member',base:{seconds:context.durationSec,rate:1,unit:'sec',amountCents:100},addons:[],meta:{}} as never;
 };
 for(const engineId of ['kling-o3-standard','kling-o3-pro','kling-o3-4k']) {
  const original=getFalEngineById(engineId)!.engine;
  const engine=resolveVideoOperationEngine(original,'v2v','kling-edit');
  const refs=[{assetId:'clip',role:'source' as const,mediaKind:'video' as const,slot:undefined,storageUrl:'https://example.com/a.mp4',width:1280,height:720,durationSec:5.25,mimeType:'video/mp4'},
   ...[0,1].map(slot=>({assetId:`image-${slot}`,role:'reference' as const,mediaKind:'image' as const,slot,storageUrl:`https://example.com/${slot}.png`,width:1280,height:720,durationSec:null,mimeType:'image/png'}))];
  const canonical=normalizeGenerationRequest({surface:'video',engineId,mode:'v2v',operation:'kling-edit',prompt:'Edit subject',settings:{resolution:engine.modeCaps!.v2v!.resolution![0]},
   references:refs.map(ref=>({kind:'asset',assetId:ref.assetId,role:ref.role,...(ref.slot===undefined?{}:{slot:ref.slot})})),elements:[{kind:'images',frontalSlot:0,referenceSlots:[1]}]});
  await priceCanonicalGenerationWithBilling(canonical,'member',{resolvedEngine:engine,resolvedReferences:refs},async context=>{assert.equal(context.referenceImageCount,2);return verify(context);});
  const site=await computeConfiguredPreflight({engine:engineId,mode:'v2v',operation:'kling-edit',durationSec:5.25,resolution:engine.modeCaps!.v2v!.resolution![0],aspectRatio:'9:16',referenceImageCount:2} as never,
   {resolvedEngine:engine,trustedMediaPricingFacts:{referenceImageCount:2},computePublicSnapshot:async context=>{assert.equal(context.referenceImageCount,2);return verify(context);}});
  assert.equal(site.ok,true,JSON.stringify(site));
 }
 const engine=getFalEngineById('kling-o3-4k')!.engine;
 const guidance=Array.from({length:4},(_,slot)=>({assetId:`guide-${slot}`,role:'reference' as const,slot,mediaKind:'image' as const,storageUrl:`https://example.com/${slot}.png`,width:1280,height:720,durationSec:null,mimeType:'image/png'}));
 for(const aspectRatio of ['16:9','9:16','1:1']) for(const durationSec of Array.from({length:13},(_,index)=>index+3)) {
  const canonical=normalizeGenerationRequest({surface:'video',engineId:engine.id,mode:'v2v',operation:'kling-reference',prompt:'Reference',settings:{resolution:'4k',durationSec,aspectRatio},references:guidance.map(ref=>({kind:'asset',assetId:ref.assetId,role:ref.role,slot:ref.slot}))});
  await priceCanonicalGenerationWithBilling(canonical,'member',{resolvedEngine:engine,resolvedReferences:guidance},async context=>{assert.equal(context.referenceImageCount,4);return verify(context);});
  const site=await computeConfiguredPreflight({engine:engine.id,mode:'v2v',operation:'kling-reference',durationSec,resolution:'4k',aspectRatio,referenceImageCount:4} as never,{resolvedEngine:engine,trustedMediaPricingFacts:{referenceImageCount:4},computePublicSnapshot:async context=>{assert.equal(context.referenceImageCount,4);return verify(context);}});
  assert.equal(site.ok,true,JSON.stringify(site));
 }
 const details=projectAgentModelModeDetails({engine,surface:'video',publicModes:['v2v'],modeCaps:engine.modeCaps!},'v2v');
 assert.match(JSON.stringify(details.operations?.find(item=>item.operation==='kling-edit')),/720–3840/);
 assert.match(engine.modeCaps!.v2v!.notes!,/3-15s/);
});

import { cloneEngine } from '../frontend/src/lib/engines';
test('operation capabilities clone without structuredClone and isolate every nested schema and UI object', () => {
 const original = getFalEngineById('kling-o3-standard')!.engine;
 const before = JSON.stringify(original.operationCaps);
 const saved = globalThis.structuredClone;
 try {
  globalThis.structuredClone = undefined as never;
  const cloned = cloneEngine(original);
  function isolated(source: unknown, copy: unknown) {
   if (!source || typeof source !== 'object') return;
   assert.notEqual(copy, source);
   for (const [key, value] of Object.entries(source)) isolated(value, (copy as Record<string, unknown>)[key]);
  }
  isolated(original.operationCaps, cloned.operationCaps);
  const edit = cloned.operationCaps!['kling-edit']!;
  edit.inputSchema.required![1].acceptedMimeTypes!.push('mutated');
  edit.inputSchema.constraints!.ownedAssetModes!.push('t2v');
  edit.ui.resolution!.push('mutated');
  assert.equal(JSON.stringify(original.operationCaps), before);
 } finally { globalThis.structuredClone = saved; }
});
