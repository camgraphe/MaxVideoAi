import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { NextRequest } from 'next/server';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { ENV } from '../frontend/src/lib/env';
import { createEnginesGetHandler } from '../frontend/app/api/engines/_lib/engines-get-handler';
import { normalizeBytePlusOptions } from '../frontend/app/api/generate/_lib/request-options-byteplus';
import { applyBytePlusSeedanceRuntimeOptions } from '../frontend/src/server/video-providers/byteplus-modelark';
import { resolveWorkspaceWorkflow } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import { quotePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { validateNormalizedGenerationAttachments } from '../frontend/app/api/generate/_lib/normalized-generation-attachment-validation';
import { validateModeMediaInputs } from '../frontend/app/api/generate/_lib/validate-media-inputs';
import { bytePlusInputVideoDurationSec } from '../frontend/server/byteplus-accounting';
import type { EngineCaps, Mode } from '../frontend/types/engines';

const modes: Mode[] = ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'];
const engine = () => getBaseEnginesByCategory('video').find(({ id }) => id === 'seedance-2-5')!;
const environment = { bytePlusEnabled: true, bytePlusApiKey: 'ark-fixture', bytePlusLasEnabled: false, bytePlusLasApiKey: undefined };
const original = { enabled: ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED, provider: ENV.SEEDANCE_2_5_PROVIDER, adminOnly: ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY, modes: ENV.SEEDANCE_2_5_BYTEPLUS_MODES };
before(() => { ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = '1'; ENV.SEEDANCE_2_5_PROVIDER = 'byteplus_modelark'; ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = '0'; ENV.SEEDANCE_2_5_BYTEPLUS_MODES = modes.join(','); });
after(() => { ENV.SEEDANCE_2_5_BYTEPLUS_ENABLED = original.enabled; ENV.SEEDANCE_2_5_PROVIDER = original.provider; ENV.SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY = original.adminOnly; ENV.SEEDANCE_2_5_BYTEPLUS_MODES = original.modes; });

for (const [name, lasEnabled, lasKey, available] of [
  ['disabled', false, 'las-fixture', false],
  ['missing credentials', true, undefined, false],
  ['configured', true, 'las-fixture', true],
] as const) {
  test(`workspace catalog exposes Edit ${name} without weakening ModelArk modes`, async () => {
    const handler = createEnginesGetHandler({
      getPublicConfiguredEnginesByCategory: async () => [engine()],
      resolveLaunchCanaryRequestContext: async () => null,
      loadAppEngineScoreMap: async () => ({}),
      fetchEngineAverageDurations: async () => [],
      getGenerationEnvironment: () => ({ ...environment, bytePlusLasEnabled: lasEnabled, bytePlusLasApiKey: lasKey }),
    } as Parameters<typeof createEnginesGetHandler>[0]);
    const result = await (await handler(new NextRequest('https://maxvideoai.com/api/engines'))).json();
    const projected = result.engines[0];
    assert.deepEqual(projected.modes, modes);
    assert.equal(projected.modeAvailability?.v2v?.available, available);
    for (const mode of ['t2v', 'i2v', 'ref2v', 'extend']) {
      assert.equal(projected.modeAvailability?.[mode]?.available, true, mode);
      assert.deepEqual(projected.modeCaps[mode].resolution, ['480p', '720p', '1080p']);
    }
    assert.deepEqual(projected.modeCaps.v2v.resolution, ['480p', '720p']);
    assert.equal(JSON.stringify(result).includes('ark-fixture'), false);
    assert.equal(JSON.stringify(result).includes('las-fixture'), false);
  });
}

test('saved Edit source retains its intent while unavailable modes and source additions are gated', () => {
  const unavailable = { ...engine(), modeAvailability: { v2v: { available: false, reason: 'provider_disabled' } } } as EngineCaps;
  const source = { id: 'source', kind: 'video', name: 'source.mp4', type: 'video/mp4', size: 1, status: 'ready', url: 'https://example.test/original.mp4', previewUrl: 'https://example.test/preview.mp4' } as const;
  const workflow = resolveWorkspaceWorkflow({ engine: unavailable, form: null, inputAssets: { video_url: [source] }, klingElements: [] });
  assert.equal(workflow.submissionMode, 'v2v');
  assert.deepEqual(workflow.workspaceExecutableModes, ['t2v', 'i2v', 'ref2v', 'extend']);
  const summary = summarizeWorkspaceInputSchema({ selectedEngine: unavailable, activeMode: 't2v', allowsUnifiedVeoFirstLast: false, isUnifiedHappyHorse: false, isUnifiedSeedance: true, isUnifiedGeminiOmni: false, uiLocale: 'fr' });
  const sourceField = summary.assetFields.find(({ field }) => field.id === 'video_url');
  assert.equal(sourceField?.disabled, true);
  assert.match(sourceField?.disabledReason ?? '', /indisponible/i);
  assert.equal(summary.assetFields.find(({ field }) => field.id === 'video_urls')?.disabled, undefined);
});

test('ModelArk Edit advertises 1080p while the retained LAS runtime rejects it', () => {
  assert.deepEqual(getFalEngineById('seedance-2-5')?.modes.find(({ mode }) => mode === 'v2v')?.ui.resolution, ['480p', '720p', '1080p']);
  for (const mode of modes) {
    const result = normalizeBytePlusOptions({ engineId: 'seedance-2-5', mode, durationSec: 4, requestedResolution: '1080p', aspectRatio: '16:9' });
    assert.equal(result.ok, mode !== 'v2v', mode);
    if (!result.ok) assert.equal(result.body.error, 'BYTEPLUS_RESOLUTION_UNSUPPORTED');
  }
  const runtime = applyBytePlusSeedanceRuntimeOptions(engine(), { provider: 'byteplus_modelark', allowedModes: modes });
  assert.deepEqual(runtime.modeCaps?.v2v?.resolution, ['480p', '720p']);
  assert.deepEqual(runtime.modeCaps?.t2v?.resolution, ['480p', '720p', '1080p']);
});

test('server Edit preflight refuses unavailable execution before media verification or pricing', async () => {
  const old = ENV.SEEDANCE_2_5_LAS_ENABLED;
  ENV.SEEDANCE_2_5_LAS_ENABLED = '0';
  try {
    const result = await resolveMediaAwarePreflight({ userId: 'fixture-owner', request: { engine: 'seedance-2-5', mode: 'v2v', durationSec: 4, resolution: '720p', aspectRatio: '16:9', fps: 24, inputs: [{ assetId: 'source', kind: 'video', slotId: 'video_url', url: 'https://example.test/original.mp4' }], user: { memberTier: 'Member' } } }, {
      getConfiguredEngineFn: async () => engine(),
      processAttachmentsFn: async () => { throw new Error('Unavailable Edit must not load owned media'); },
      computeConfiguredPreflightFn: async () => { throw new Error('Unavailable Edit must not compute pricing'); },
    });
    assert.equal(result.ok, false); assert.equal(result.error?.code, 'ENGINE_MODE_UNAVAILABLE');
  } finally { ENV.SEEDANCE_2_5_LAS_ENABLED = old; }
});

test('public Edit quote refuses unavailable execution before reading tariffs', async () => {
  const old = ENV.SEEDANCE_2_5_LAS_ENABLED;
  ENV.SEEDANCE_2_5_LAS_ENABLED = '0';
  try {
    let reads = 0;
    const result = await quotePublicModelScenario({ modelId: 'seedance-2-5', mode: 'v2v', durationSec: 4, resolution: '720p', aspectRatio: '16:9', inputVideoDurationSec: 4, hasVideoInput: true }, async () => { reads += 1; return { totalCents: 123, currency: 'USD' } as never; });
    assert.deepEqual(result, { status: 'unavailable' }); assert.equal(reads, 0);
  } finally { ENV.SEEDANCE_2_5_LAS_ENABLED = old; }
});

test('trusted Edit cost counts the original and supplementary motion references', async () => {
  const source = 'https://example.test/source-original.mp4';
  const stale = 'https://example.test/stale-motion.mp4';
  const processed = await validateNormalizedGenerationAttachments({ engineId: 'seedance-2-5', mode: 'v2v', userId: 'owner', inputSchema: engine().inputSchema, attachments: [
    { name: 'stale.mp4', type: 'video/mp4', size: 1, kind: 'video', slotId: 'video_urls', url: stale, assetId: 'stale', durationSec: 999 },
    { name: 'source.mp4', type: 'video/mp4', size: 1, kind: 'video', slotId: 'video_url', url: source, assetId: 'source', durationSec: 999 },
  ], mediaConstraintDeps: { queryFn: async <T>() => [
    { asset_id: 'source', url: source, origin_url: null, original_name: 'source.mp4', mime_type: 'video/mp4', size_bytes: 1000, duration_sec: 4.25, width: 1280, height: 720 },
    { asset_id: 'stale', url: stale, origin_url: null, original_name: 'stale.mp4', mime_type: 'video/mp4', size_bytes: 1000, duration_sec: 20, width: 1280, height: 720 },
  ] as T[] } });
  assert.equal(processed.ok, true, JSON.stringify(processed));
  if (!processed.ok) return;
  assert.deepEqual(processed.references.videoUrls, [source, stale]);
  assert.equal(bytePlusInputVideoDurationSec('seedance-2-5', processed.trustedMediaReferences ?? []), 24.25);
  assert.deepEqual(new Set(processed.trustedMediaReferences?.filter(({ kind }) => kind === 'video').map(({ url }) => url)), new Set([source, stale]));
  const validated = validateModeMediaInputs({ engineId: 'seedance-2-5', normalizedMode: 'v2v', payload: { video_url: source, video_urls: [stale] } as never,
    inputSchema: engine().inputSchema, referenceValuesByField: processed.references.referenceValuesByField,
    referenceMediaItems: processed.references.referenceMediaItems, referenceProvenanceIssues: processed.references.referenceProvenanceIssues });
  assert.equal(validated.ok, true, JSON.stringify(validated));
});
