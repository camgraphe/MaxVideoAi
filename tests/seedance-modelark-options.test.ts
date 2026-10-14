import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBytePlusSeedancePayload } from '../frontend/src/server/video-providers/byteplus-modelark-payload';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { applyBytePlusSeedanceRuntimeOptions } from '../frontend/src/server/video-providers/byteplus-modelark-profile-policy';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { evaluateReferenceBudget, resolveEngineReferenceBudget } from '../frontend/lib/reference-budget';
import { getGenerationIterationGuardMessage } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-guards';
import { submitBytePlusGenerateTask } from '../frontend/app/api/generate/_lib/byteplus-submission';
import { ENV } from '../frontend/src/lib/env';
import { resolveSeedance25ModelArkEditSource } from '../frontend/server/seedance-edit-source';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { projectAgentModelModeDetails } from '../frontend/src/server/agent-api/model-details';
import * as optionCopy from '../frontend/lib/seedance-modelark-options';

const base = { modelId: 'dreamina-seedance-2-5-260628', prompt: 'A landscape.', durationSec: 4,
  resolution: '480p', ratio: '16:9', allowedDurationOptions: [4, 30], allowedResolutions: ['480p'] as ['480p'], transport: 'modelark' as const };

test('ModelArk creative output choices survive payload construction without changing defaults', () => {
  const selected = buildBytePlusSeedancePayload({ ...base, outputFormat: 'mov', returnLastFrame: true, watermark: true } as any) as any;
  assert.equal(selected.output_format, 'mov');
  assert.equal(selected.return_last_frame, true);
  assert.equal(selected.watermark, true);
  const ordinary = buildBytePlusSeedancePayload(base) as any;
  assert.equal(ordinary.watermark, false);
  assert.equal(ordinary.output_format, undefined);
  assert.equal(ordinary.return_last_frame, undefined);
});

test('Auto sends provider duration -1 while retaining a positive billed duration input', () => {
  const payload = buildBytePlusSeedancePayload({ ...base, durationSec: 30, durationOption: 'auto', ratio: 'auto' } as any);
  assert.equal(payload.duration, -1);
  assert.equal(payload.ratio, 'adaptive');
});

test('2.5 allows audio-only Omni references while 2.0 refuses them', () => {
  const input = { ...base, mode: 'ref2v' as const, referenceAudioUrls: ['https://media.example/sound.wav'] };
  const payload = buildBytePlusSeedancePayload(input);
  assert.deepEqual(payload.content.map(item => item.type), ['text', 'audio_url']);
  assert.throws(() => buildBytePlusSeedancePayload({ ...input, modelId: 'dreamina-seedance-2-0-mini-260615' }),
    (error: any) => error.code === 'REFERENCE_MEDIA_REQUIRED');
});

test('unsupported formats and malformed switches stop before a provider request can be made', () => {
  for (const options of [{ outputFormat: 'avi' }, { returnLastFrame: 'true' }, { watermark: 1 }]) {
    assert.throws(() => buildBytePlusSeedancePayload({ ...base, ...options } as any),
      (error: any) => error.code === 'BYTEPLUS_OUTPUT_OPTIONS_INVALID');
  }
  assert.throws(() => buildBytePlusSeedancePayload({ ...base, modelId: 'dreamina-seedance-2-0-fast-260128', outputFormat: 'mov' } as any),
    (error: any) => error.code === 'BYTEPLUS_OUTPUT_FORMAT_UNSUPPORTED');
});

test('primary source plus supplementary videos obey the aggregate model video limit', () => {
  const references = Array.from({ length: 11 }, (_, index) => `https://media.example/${index}.mp4`);
  assert.throws(() => buildBytePlusSeedancePayload({ ...base, mode: 'v2v', referenceVideoUrls: references }),
    (error: any) => error.code === 'BYTEPLUS_REFERENCE_TYPE_BUDGET_EXCEEDED');
});

test('workspace discovers the creative controls and extension image/audio references', () => {
  const entry = getFalEngineById('seedance-2-5')!;
  const engine = applyBytePlusSeedanceRuntimeOptions(entry.engine, { provider: 'byteplus_modelark', allowedModes: ['t2v','i2v','ref2v','v2v','extend'] });
  const summary = summarizeWorkspaceInputSchema({ selectedEngine: engine, activeMode: 'extend', allowsUnifiedVeoFirstLast: false,
    isUnifiedHappyHorse: false, isUnifiedSeedance: true, isUnifiedGeminiOmni: false, uiLocale: 'en' });
  assert.ok(summary.secondaryFields.some(({field}) => field.id === 'output_format'));
  assert.ok(summary.secondaryFields.some(({field}) => field.id === 'return_last_frame'));
  assert.ok(summary.secondaryFields.some(({field}) => field.id === 'watermark'));
  assert.ok(summary.assetFields.some(({field}) => field.id === 'image_urls'));
  assert.ok(summary.assetFields.some(({field}) => field.id === 'audio_urls'));
});

test('workspace reference budget counts the source and additional clips together', () => {
  const budget = resolveEngineReferenceBudget(getFalEngineById('seedance-2-5')!.engine.inputSchema, 'v2v')!;
  const result = evaluateReferenceBudget({ budget, valuesByField: { video_url: ['source'],
    video_urls: Array.from({ length: 10 }, (_, index) => `ref-${index}`) }, getIdentity: value => value });
  assert.equal(result.ok, false);
});

test('workspace permits audio-only references only for the model that supports them', () => {
  const input = { selectedEngineId: 'seedance-2-5', selectedEngineLabel: 'Seedance', submissionMode: 'ref2v',
    isUnifiedSeedance: true, inputSchema: getFalEngineById('seedance-2-5')!.engine.inputSchema,
    referenceImageUrls: [], referenceVideoUrls: [], referenceAudioUrls: ['https://media.example/sound.wav'],
    lumaContext: {}, primaryAssetFieldLabel: 'Image' } as any;
  assert.equal(getGenerationIterationGuardMessage(input), null);
  assert.ok(getGenerationIterationGuardMessage({ ...input, selectedEngineId: 'seedance-2-0-mini' }));
});

test('Edit inherits the primary source facts even when supplementary videos have different dimensions and timing', () => {
  const previous = ENV.SEEDANCE_2_5_EDIT_TRANSPORT;
  ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'modelark';
  try {
    const source = resolveSeedance25ModelArkEditSource('seedance-2-5', 'v2v', [
      { kind: 'video', fieldId: 'video_urls', durationSec: 6, width: 480, height: 854 },
      { kind: 'video', fieldId: 'video_url', durationSec: 4.25, width: 854, height: 480 },
    ] as any);
    assert.equal(source?.durationSec, 4.25); assert.equal(source?.pricingAspectRatio, '16:9');
    assert.throws(() => resolveSeedance25ModelArkEditSource('seedance-2-5', 'v2v', [
      { kind: 'video', fieldId: 'video_urls', durationSec: 6, width: 480, height: 854 },
    ] as any), /source video/i);
    ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'las';
    assert.equal((resolveSeedance25ModelArkEditSource as any)('seedance-2-5', 'v2v', [
      {kind: 'video', fieldId: 'video_url', durationSec: 4.25, width: 854, height: 480},
    ], 'modelark')?.durationSec, 4.25);
  } finally { ENV.SEEDANCE_2_5_EDIT_TRANSPORT = previous; }
});

test('generation submission forwards selected output controls and Extend references to the real provider builder', async () => {
  const prior = { enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED, provider: ENV.SEEDANCE_2_5_PROVIDER };
  ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = 'true'; ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark';
  let outgoing: Record<string, unknown> | undefined;
  try {
    const result = await submitBytePlusGenerateTask({ jobId: 'job-options', userId: 'owner', engineId: 'seedance-2-5', engineLabel: 'Seedance 2.5',
      prompt: 'Continue the scene.', durationSec: 30, durationOption: 'auto', mode: 'extend', initialImageUrl: null, endImageUrl: null,
      normalizedReferenceImages: ['https://media.example/look.png'], videoUrls: ['https://media.example/source.mp4'],
      resolvedAudioUrl: null, audioUrls: ['https://media.example/sound.wav'], effectiveResolution: '480p', aspectRatio: '16:9', audioEnabled: true,
      extraInputValues: { output_format: 'mov', return_last_frame: true, watermark: true },
      placeholderThumb: '/frame.svg', pricing: {totalCents: 123, currency: 'USD'}, paymentStatus: 'paid_wallet',
      pendingReceipt: null, paymentMode: 'wallet', walletChargeReserved: true, batchId: null, groupId: null,
      iterationIndex: 0, iterationCount: 1, renderIds: [], heroRenderId: null, localKey: null,
      deps: { getBytePlusArkConfigFn: () => ({ seedance25ModelId: 'dreamina-seedance-2-5-260628' }),
        getBytePlusModelArkClientFn: () => ({ createSeedanceFastTask: async (payload: Record<string, unknown>) => {
          outgoing = payload; return { providerJobId: 'fixture-only-task', status: 'queued' };
        } }), queryFn: async () => [] },
    } as any);
    assert.equal(result.ok, true);
    assert.equal(outgoing?.output_format, 'mov'); assert.equal(outgoing?.return_last_frame, true); assert.equal(outgoing?.watermark, true);
    assert.equal(outgoing?.duration, -1);
    assert.deepEqual((outgoing?.content as Array<{type:string}>).map(item => item.type), ['text','image_url','video_url','audio_url']);
  } finally { ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = prior.enabled; ENV.SEEDANCE_2_5_PROVIDER = prior.provider; }
});

test('MCP validates, advertises and materializes the same Seedance output choices as the workspace', () => {
  const entry = getFalEngineById('seedance-2-5')!;
  const engine = entry.engine;
  const candidate = {engine, surface: 'video', publicModes: ['t2v'], modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui]))} as any;
  const request = normalizeGenerationRequest({ surface: 'video', engineId: engine.id, mode: 't2v', prompt: 'A landscape.',
    settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', outputFormat: 'mov', returnLastFrame: true, watermark: true }, references: [] });
  validateCanonicalGenerationCapabilities(request, candidate);
  const body = buildPaidVideoRequestBody({ quoteId: 'fixture-quote', request, engine, canonicalPricing: { membershipTier: 'member' } });
  assert.deepEqual(body.extraInputValues, { output_format: 'mov', return_last_frame: true, watermark: true });
  const details = projectAgentModelModeDetails(candidate, 't2v');
  assert.ok(details.settings.some(setting => setting.key === 'returnLastFrame'));
  assert.ok(details.settings.some(setting => setting.key === 'outputFormat' && setting.values?.includes('mov')));
  assert.ok(details.settings.some(setting => setting.key === 'durationOption' && setting.values?.includes('auto')));
});

test('automatic quote copy discloses the fixed maximum price and keeps source-timed Edit distinct', () => {
  assert.equal(typeof (optionCopy as any).getSeedanceAutomaticPricingNote, 'function');
  const note = (optionCopy as any).getSeedanceAutomaticPricingNote({engineId: 'seedance-2-0-mini', mode: 't2v',
    durationOption: 'auto', aspectRatio: 'auto', locale: 'fr'});
  assert.match(note, /tarif fixe.*15\s*s/i);
  assert.match(note, /plus courte/i); assert.match(note, /six formats/i);
  assert.equal((optionCopy as any).getSeedanceAutomaticPricingNote({engineId: 'seedance-2-5', mode: 'v2v',
    durationOption: 'auto', aspectRatio: 'auto', locale: 'fr', inheritsSourceVideo: true}), null);
});
