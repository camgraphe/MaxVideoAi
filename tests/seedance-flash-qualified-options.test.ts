import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { projectSeedance25ModeAvailability } from '../frontend/server/engine-mode-availability';
import { projectAgentModelModeDetails } from '../frontend/src/server/agent-api/model-details';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { validateGenerationMediaConstraints } from '../frontend/app/api/generate/_lib/generation-media-constraints';
import { getMediaInputEligibility } from '../frontend/lib/media-input-eligibility';
import { getMediaExcerptLimits } from '../frontend/lib/video-excerpt';
import { getGenerationIterationGuardMessage } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-guards';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';

const entry = getFalEngineById('seedance-2-5-flash')!;
const projected = projectSeedance25ModeAvailability({ ...entry.engine,
  modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])) });
// These tests exercise schema/quote admission, independent of the production launch switch.
const engine = { ...projected, modeAvailability: Object.fromEntries(Object.entries(projected.modeAvailability ?? {})
  .map(([mode, availability]) => [mode, { ...availability, available: true }])) };
const candidate = { engine, surface: 'video', publicModes: engine.modes, modeCaps: engine.modeCaps } as AgentPublicGenerationEngine;
const fields = [...engine.inputSchema!.required!, ...engine.inputSchema!.optional!];
const field = (id: string) => fields.find(item => item.id === id)!;
const url = 'https://media.maxvideoai.com/owned/reference.mp4';

test('Flash MOV reaches the shared workspace, canonical quote body and MCP/Studio setting projection', () => {
  const summary = summarizeWorkspaceInputSchema({ selectedEngine: engine, activeMode: 'extend', allowsUnifiedVeoFirstLast: false,
    isUnifiedHappyHorse: false, isUnifiedSeedance: true, isUnifiedGeminiOmni: false, uiLocale: 'en' });
  assert.ok(summary.secondaryFields.some(({ field }) => field.id === 'output_format'));
  const request = normalizeGenerationRequest({ surface: 'video', engineId: engine.id, mode: 't2v', prompt: 'A ceramic cup.',
    settings: { durationSec: 4, resolution: '480p', aspectRatio: '16:9', outputFormat: 'mov' }, references: [] });
  validateCanonicalGenerationCapabilities(request, candidate);
  const body = buildPaidVideoRequestBody({ quoteId: 'fixture', request, engine, canonicalPricing: { membershipTier: 'member' } });
  assert.deepEqual(body.extraInputValues, { output_format: 'mov' });
  for (const mode of ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'] as const) {
    const details = projectAgentModelModeDetails(candidate, mode);
    assert.ok(details.settings.some(setting => setting.key === 'outputFormat' && setting.values?.includes('mov')));
  }
});

test('Flash audio-only references pass the actual workspace submission guard', () => {
  const input = { selectedEngineId: engine.id, selectedEngineLabel: engine.label, submissionMode: 'ref2v',
    isUnifiedSeedance: true, inputSchema: engine.inputSchema, referenceImageUrls: [], referenceVideoUrls: [],
    referenceAudioUrls: ['https://media.maxvideoai.com/owned/tone.wav'], lumaContext: {}, primaryAssetFieldLabel: 'Image' };
  assert.equal(getGenerationIterationGuardMessage(input as Parameters<typeof getGenerationIterationGuardMessage>[0]), null);
  assert.ok(getGenerationIterationGuardMessage({ ...input, referenceAudioUrls: [] } as Parameters<typeof getGenerationIterationGuardMessage>[0]));
});

test('Flash library selection and excerpt preparation distinguish Create references from Modify timing', () => {
  const asset = { kind: 'video' as const, url, mime: 'video/mp4', size: 1000, width: 854, height: 480, durationSec: 3 };
  assert.equal(getMediaInputEligibility({ asset, field: field('video_urls'), engine, mode: 'ref2v' }).status, 'usable');
  assert.equal(getMediaInputEligibility({ asset, field: field('video_urls'), engine, mode: 'v2v' }).durationIssue, 'too-short');
  assert.equal(getMediaExcerptLimits(engine, 'v2v', 'video_urls')?.minDurationSec, 4);
  assert.equal(getMediaExcerptLimits(engine, 'ref2v', 'video_urls')?.minDurationSec, 2);
  assert.equal(getMediaExcerptLimits(engine, 'extend', 'extension_source_videos')?.minDurationSec, 2);
  assert.equal(getMediaInputEligibility({ asset: { ...asset, durationSec: 1.9 }, field: field('extension_source_videos'), engine, mode: 'extend' }).durationIssue, 'too-short');
});

test('MCP and Studio publish per-mode source and reference durations', () => {
  for (const [mode, expected] of [['ref2v', 2], ['v2v', 4], ['extend', 2]] as const) {
    const details = projectAgentModelModeDetails(candidate, mode);
    for (const video of details.references.filter(ref => ref.type === 'video')) {
      assert.equal(video.durationSec?.min, expected);
      assert.equal(video.durationSec?.combinedMax, 30.2);
    }
    assert.deepEqual(details.references.find(ref => ref.type === 'audio')?.durationSec, { min: 2, max: 30, combinedMax: 30 });
  }
});

test('web execution rejects short or excessive owned references before provider submission', async () => {
  for (const [mode, fieldId, durationSec, valid] of [
    ['ref2v', 'video_urls', 2, true], ['ref2v', 'video_urls', 1.99, false],
    ['v2v', 'video_url', 3.99, false], ['v2v', 'video_urls', 3, false], ['v2v', 'video_urls', 4, true],
    ['extend', 'extension_source_videos', 2, true], ['extend', 'extension_source_videos', 30.21, false],
    ['ref2v', 'audio_urls', 1.99, false], ['ref2v', 'audio_urls', 2, true], ['ref2v', 'audio_urls', 30.01, false],
  ] as const) {
    const kind = fieldId === 'audio_urls' ? 'audio' : 'video';
    const mediaUrl = kind === 'audio' ? 'https://media.maxvideoai.com/owned/tone.wav' : url;
    const mime = kind === 'audio' ? 'audio/wav' : 'video/mp4';
    const result = await validateGenerationMediaConstraints({ engineId: engine.id, mode, userId: 'owner', inputSchema: engine.inputSchema,
      attachments: [{ name: kind === 'audio' ? 'tone.wav' : 'reference.mp4', type: mime, size: 1000, kind, slotId: fieldId, url: mediaUrl, assetId: 'owned' }],
      referenceMediaItems: [{ fieldId, kind, url: mediaUrl }], deps: { queryFn: async <T>() => [{ asset_id: 'owned', url: mediaUrl,
        original_name: kind === 'audio' ? 'tone.wav' : 'reference.mp4', mime_type: mime, size_bytes: 1000,
        width: 854, height: 480, duration_sec: durationSec }] as T[] } });
    assert.equal(result.ok, valid, `${mode}/${fieldId}/${durationSec}: ${JSON.stringify(result)}`);
    if (!result.ok) assert.equal(result.body.error, 'MEDIA_DURATION_UNSUPPORTED');
  }
});

test('canonical confirmation rechecks the stricter Modify minimum for supplementary videos', () => {
  const request = normalizeGenerationRequest({ surface: 'video', engineId: engine.id, mode: 'v2v', prompt: 'Change the cup to blue.',
    settings: { resolution: '480p' }, references: [
      { kind: 'asset', assetId: 'source', role: 'source' }, { kind: 'asset', assetId: 'reference', role: 'reference' },
    ] });
  const resolved: ResolvedReference[] = request.references.map(reference => ({ assetId: reference.kind === 'asset' ? reference.assetId : '', role: reference.role, slot: reference.slot,
    mediaKind: 'video', storageUrl: `https://media.maxvideoai.com/owned/${reference.role}.mp4`, width: 854, height: 480,
    durationSec: 4, mimeType: 'video/mp4', sizeBytes: 1000 }));
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(request, candidate, { resolvedReferences: resolved }));
  assert.throws(() => validateCanonicalGenerationCapabilities(request, candidate,
    { resolvedReferences: [resolved[0]!, { ...resolved[1]!, durationSec: 3 }] }));
});
