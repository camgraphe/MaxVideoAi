import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { getBaseEngineIncludingHidden } from '../frontend/src/lib/engines';
import { ENV } from '../frontend/src/lib/env';
import { buildBytePlusSeedancePayload, getBytePlusSeedanceProfile, resolveBytePlusSeedanceModelId, getBytePlusArkConfig } from '../frontend/src/server/video-providers/byteplus-modelark';
import { isBytePlusSeedanceSubmissionEnabled, isBytePlusSeedanceAdminOnly, requiresBytePlusSeedanceEarlyGate } from '../frontend/src/server/video-providers/byteplus-modelark-profile-policy';
import { resolveBytePlusTransport } from '../frontend/src/server/video-providers/byteplus-modelark-transport';
import { validateProviderSpecificConstraints } from '../frontend/src/server/video-generation/execution-constraints';
import { isUnifiedSeedanceEngineId } from '../frontend/lib/seedance-workflow';
import { seedanceAutomaticDurationBounds } from '../frontend/src/lib/seedance-option-pricing';
import { getBytePlusVideoListRate } from '../frontend/server/byteplus-list-tariff';
import { estimateBytePlusBillableTokens, bytePlusInputVideoDurationSec } from '../frontend/server/byteplus-accounting';
import { projectSeedance25ModeAvailability } from '../frontend/server/engine-mode-availability';
import { projectAgentModelModeDetails } from '../frontend/src/server/agent-api/model-details';
import { createAgentModelCatalogDeps, listPublicAgentCatalogEngines } from '../frontend/src/server/agent-api/model-catalog';
import { getPromptAssistanceProfile } from '../frontend/src/server/prompt-assistance/profiles';
import { isStudioConversationVideoModeCertified } from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/models/workspace-model-certification';

const id = 'seedance-2-5-flash';
const modelId = 'dreamina-seedance-2-5-flash-261115';
const engine = getBaseEngineIncludingHidden(id)!;
const profile = getBytePlusSeedanceProfile(id)!;
const urls = (n: number, extension: string) => Array.from({ length: n }, (_, i) => `https://example.com/${i}.${extension}`);
const payload = (overrides: Partial<Parameters<typeof buildBytePlusSeedancePayload>[0]> = {}) => buildBytePlusSeedancePayload({
  modelId, prompt: 'A dancer crosses the stage.', mode: 't2v', durationSec: 30, resolution: '720p', ratio: '16:9',
  transport: 'modelark', allowedModes: [...profile.supportedModes], allowedResolutions: [...profile.resolutions],
  allowedDurationOptions: [...profile.durationOptions], allowedAspectRatios: [...profile.aspectRatios], ...overrides,
});

test('Flash has independent admission and never borrows the flagship activation', () => {
  const before = { ...ENV };
  try {
    Object.assign(ENV, { SEEDANCE_2_5_BYTEPLUS_ENABLED: 'true', SEEDANCE_2_5_PROVIDER: 'byteplus_modelark',
      SEEDANCE_2_5_FLASH_BYTEPLUS_ENABLED: 'false', SEEDANCE_2_5_FLASH_PROVIDER: 'disabled' });
    assert.equal(isBytePlusSeedanceSubmissionEnabled(id), false);
    assert.equal(requiresBytePlusSeedanceEarlyGate(id), true);
    assert.equal(isBytePlusSeedanceAdminOnly(id), true);
    Object.assign(ENV, { SEEDANCE_2_5_FLASH_BYTEPLUS_ENABLED: 'true', SEEDANCE_2_5_FLASH_PROVIDER: 'byteplus_modelark' });
    assert.equal(isBytePlusSeedanceSubmissionEnabled(id), true);
    for (const mode of profile.supportedModes) assert.equal(resolveBytePlusTransport(id, mode), 'modelark');
    assert.equal(resolveBytePlusSeedanceModelId(id, getBytePlusArkConfig()), modelId);
  } finally { Object.assign(ENV, before); }
});

test('Flash preserves its explicit 10/5/5 schema without flagship MOV or Draft', () => {
  assert.equal(isUnifiedSeedanceEngineId(id), true);
  assert.deepEqual(engine.resolutions, ['480p', '720p']);
  assert.deepEqual(seedanceAutomaticDurationBounds(id), { min: 4, max: 30 });
  assert.deepEqual(engine.inputSchema?.referenceBudget?.maxByType, { image: 10, video: 5, audio: 5 });
  assert.equal(engine.inputSchema?.referenceBudget?.maxTotal, 20);
  const fields = [...engine.inputSchema!.required, ...engine.inputSchema!.optional];
  for (const [fieldId, maximum] of [['image_urls', 10], ['video_urls', 5], ['audio_urls', 5], ['extension_source_videos', 5]] as const) {
    assert.equal(fields.find(f => f.id === fieldId)?.maxCount, maximum);
  }
  assert.equal(fields.some(f => ['output_format', 'draft', 'watermark', 'return_last_frame'].includes(f.id)), false);
  assert.equal(payload().duration, 30);
  assert.equal(payload({ durationOption: 'auto' }).duration, -1);
});

test('provider rejects over-limit Flash references even without a supplied schema budget', () => {
  const allowed = payload({ mode: 'ref2v', referenceImageUrls: urls(10, 'png'), referenceVideoUrls: urls(5, 'mp4'), referenceAudioUrls: urls(5, 'wav') });
  assert.equal(allowed.content.length, 21);
  for (const overrides of [
    { referenceImageUrls: urls(11, 'png') }, { referenceImageUrls: urls(1, 'png'), referenceVideoUrls: urls(6, 'mp4') },
    { referenceImageUrls: urls(1, 'png'), referenceAudioUrls: urls(6, 'wav') },
  ]) assert.throws(() => payload({ mode: 'ref2v', ...overrides }), { code: 'BYTEPLUS_REFERENCE_TYPE_BUDGET_EXCEEDED' });
  assert.throws(() => payload({ outputFormat: 'mov' }), { code: 'BYTEPLUS_OUTPUT_FORMAT_UNSUPPORTED' });
  for (const resolution of ['1080p', '4k'] as const) assert.throws(() => payload({ resolution, allowedResolutions: [resolution] }), { code: 'BYTEPLUS_FLASH_OPTIONS_UNSUPPORTED' });
  assert.throws(() => payload({ transport: 'las' }), { code: 'BYTEPLUS_FLASH_OPTIONS_UNSUPPORTED' });
  assert.throws(() => payload({ mode: 'ref2v', referenceAudioUrls: urls(1, 'wav') }), { code: 'REFERENCE_MEDIA_REQUIRED' });
});

test('five ordered extension sources survive the execution guard; six are refused', () => {
  for (const [count, ok] of [[3, true], [4, false]] as const) assert.equal(validateProviderSpecificConstraints({
    engineId: 'seedance-2-5', normalizedMode: 'extend', payload: { extension_source_videos: urls(count, 'mp4') },
  }).ok, ok, 'flagship extension keeps its three-source limit independently of its ten reference-video slots');
  for (const [count, ok] of [[5, true], [6, false]] as const) assert.equal(validateProviderSpecificConstraints({
    engineId: id, normalizedMode: 'extend', payload: { extension_source_videos: urls(count, 'mp4') },
  }).ok, ok);
  const extended = payload({ mode: 'extend', referenceVideoUrls: urls(5, 'mp4') });
  assert.equal(extended.omni_reference_task_type, 'extend');
  assert.equal(extended.ratio, 'adaptive');
  const edited = payload({ mode: 'v2v', referenceVideoUrls: urls(1, 'mp4') });
  assert.equal(edited.omni_reference_task_type, 'edit');
  assert.equal(edited.duration, -1);
  assert.equal(payload({ mode: 'i2v', imageUrl: urls(1, 'png')[0] }).ratio, undefined);
});

test('Flash supplier accounting uses its own rates and the 30-second video-input domain', () => {
  for (const [type, rate] of [['no_video_input', 0.007], ['video_input', 0.0043]] as const) {
    const quoted = getBytePlusVideoListRate({ profile: 'seedance25Flash', resolution: '720p', billingInputType: type });
    assert.equal(quoted.unitPriceUsdPer1kTokens, rate);
    assert.equal(quoted.source.checkedAt, '2026-11-13');
    assert.equal(quoted.promotion, null);
  }
  assert.throws(() => getBytePlusVideoListRate({ profile: 'seedance25Flash', resolution: '1080p', billingInputType: 'no_video_input' }));
  assert.equal(bytePlusInputVideoDurationSec(id, [{ kind: 'video', durationSec: 29.75 }]), 29.75);
  const estimate = estimateBytePlusBillableTokens({ engineId: id, durationSec: 5, resolution: '720p', aspectRatio: '16:9', billingInputType: 'video_input', inputVideoDurationSec: 4.25 });
  assert.equal(estimate?.tokenCount, 199800);
  assert.equal(estimate?.minimumTokens, 194400);
});

test('MCP, Studio and Milo derive the same Flash controls and keep public discovery gated', async () => {
  const projected = projectSeedance25ModeAvailability({ ...engine, modeCaps: Object.fromEntries(getFalEngineById(id)!.modes.map(m => [m.mode, m.ui])) });
  for (const mode of profile.supportedModes) {
    assert.equal(isStudioConversationVideoModeCertified(id, mode), true);
    const details = projectAgentModelModeDetails({ engine: projected, surface: 'video', modeCaps: projected.modeCaps! }, mode as never);
    assert.ok(details);
    assert.equal(getPromptAssistanceProfile(id, mode).family, 'seedance');
  }
  const deps = { ...createAgentModelCatalogDeps(), listEngines: async () => [engine], isModeExecutable: () => true, isEngineExecutable: () => true };
  assert.deepEqual(await listPublicAgentCatalogEngines(deps), []);
  assert.deepEqual(await listPublicAgentCatalogEngines(deps, { exactId: id }), []);
  const canary = await listPublicAgentCatalogEngines(deps, { exactId: id, access: { allowedPrelaunchModelIds: new Set([id]) } });
  assert.equal(canary[0]?.engine.id, id);
});
