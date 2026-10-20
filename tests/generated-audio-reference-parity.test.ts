import assert from 'node:assert/strict';
import test from 'node:test';
import { createStorageFileKey } from '../frontend/server/storage';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { resolveOwnedReferenceAssetForActor } from '../frontend/src/server/agent-api/reference-assets';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { GenerationCapabilityError, validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';
import type { NormalizedAttachment } from '../frontend/app/api/generate/_lib/generation-attachment-types';
import { validateGenerationMediaConstraints } from '../frontend/app/api/generate/_lib/generation-media-constraints';

const assetId = 'ma_0123456789abcdef0123456789abcdef';
const actor = { authMethod: 'toolbox-session' as const, userId: 'audio-owner', clientId: null };
const entry = getFalEngineById('wan-3')!;
const candidate: AgentPublicGenerationEngine = {
  engine: entry.engine, surface: 'video', publicModes: ['ref2v'],
  modeCaps: { ref2v: entry.modes.find(mode => mode.mode === 'ref2v')!.ui },
};
const request = normalizeGenerationRequest({
  schemaVersion: 1, surface: 'video', engineId: 'wan-3', mode: 'ref2v', prompt: 'Use the supplied voice.', outputCount: 1,
  settings: { durationSec: 11, resolution: '480p', aspectRatio: '16:9' },
  references: [{ kind: 'asset', role: 'reference', assetId }],
});

async function resolveStoredAudio(url: string, overrides: { mimeType?: string; sizeBytes?: number | null; originalName?: string; owner?: string } = {}) {
  return {
    ...await resolveOwnedReferenceAssetForActor(actor, assetId, { executor: {
      async query<T>(_sql: string, params?: ReadonlyArray<unknown>) {
        assert.deepEqual(params, [assetId, actor.userId]);
        return [{ id: 'internal-audio-id', public_id: assetId, user_id: overrides.owner ?? actor.userId,
          kind: 'audio', url, mime_type: overrides.mimeType ?? 'audio/mpeg', size_bytes: overrides.sizeBytes === undefined ? 165973 : overrides.sizeBytes,
          width: null, height: null, status: 'ready', deleted_at: null,
          metadata: { durationSec: 10.371, mediaFacts: { source: 'probe', durationSec: 10.371 },
            originUrl: 'https://media.maxvideoai.com/renders/original.mp3',
            ...(overrides.originalName ? { originalName: overrides.originalName } : {}) },
        }] as T[];
      },
    } }), role: 'reference' as const,
  };
}

async function validateConfirmation(resolved: ResolvedReference, trusted = [resolved]) {
  const body = buildPaidVideoRequestBody({ quoteId: 'quote-audio', request, engine: entry.engine,
    canonicalPricing: { membershipTier: 'member' }, resolvedReferences: [resolved] });
  const result = await validateGenerationMediaConstraints({
    engineId: 'wan-3', mode: 'ref2v', userId: actor.userId, inputSchema: entry.engine.inputSchema,
    attachments: body.inputs as NormalizedAttachment[],
    referenceMediaItems: [{ fieldId: 'reference_audio_urls', kind: 'audio', url: resolved.storageUrl }],
    trustedResolvedReferences: trusted,
    deps: { queryFn: async () => { throw new Error('Trusted confirmation must not resolve another source'); } },
  });
  return { result, body };
}

function expectQuoteFailure(resolved: ResolvedReference, failure: string) {
  assert.throws(() => validateCanonicalGenerationCapabilities(request, candidate, { resolvedReferences: [resolved] }),
    error => error instanceof GenerationCapabilityError && error.referenceFailure === failure);
}

test('generated MPEG audio storage copies use .mp3 while MPEG video retains .mpeg', () => {
  for (const fileName of [undefined, 'Female demo narration']) {
    const key = createStorageFileKey({ mime: 'audio/mpeg', userId: actor.userId, prefix: 'media-assets', fileName });
    assert.match(key, /^media-assets\/audio-owner\/[a-f0-9-]+\.mp3$/);
  }
  assert.match(createStorageFileKey({ mime: 'audio/mpeg; codecs=mp3', prefix: 'renders' }), /\.mp3$/);
  assert.match(createStorageFileKey({ mime: 'video/mpeg' }), /\.mpeg$/);
});

test('new generated MP3 remains the exact owned copy through quote and confirmation', async () => {
  const key = createStorageFileKey({ mime: 'audio/mpeg', userId: actor.userId, prefix: 'media-assets' });
  const url = `https://media.maxvideoai.com/${key}`;
  const resolved = await resolveStoredAudio(url);
  assert.equal(resolved.storageUrl, url);
  assert.equal(resolved.mimeType, 'audio/mpeg');
  assert.equal(resolved.originalName, undefined);
  validateCanonicalGenerationCapabilities(request, candidate, { resolvedReferences: [resolved] });
  const { result, body } = await validateConfirmation(resolved);
  assert.equal(result.ok, true, JSON.stringify(result));
  const inputs = body.inputs as NormalizedAttachment[];
  assert.equal(inputs[0]?.url, url);
  assert.equal(inputs[0]?.assetId, assetId);
  assert.equal(inputs[0]?.type, 'audio/mpeg');
});

test('legacy .mpeg copies fail during preparation instead of only after reservation', async () => {
  const resolved = await resolveStoredAudio('https://media.maxvideoai.com/media-assets/audio-owner/legacy.mpeg');
  assert.equal(resolved.storageUrl.endsWith('.mpeg'), true, 'originUrl never substitutes another object');
  expectQuoteFailure(resolved, 'format_unsupported');
  const { result } = await validateConfirmation(resolved);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.body.error, 'MEDIA_FORMAT_UNSUPPORTED');
});

test('unsupported, oversized or unverified audio cannot obtain an executable quote', async () => {
  expectQuoteFailure(await resolveStoredAudio('https://media.maxvideoai.com/audio.m4a', { mimeType: 'audio/mp4' }), 'format_unsupported');
  expectQuoteFailure(await resolveStoredAudio('https://media.maxvideoai.com/audio.mp3', { sizeBytes: 16 * 1024 * 1024 }), 'size_exceeded');
  expectQuoteFailure(await resolveStoredAudio('https://media.maxvideoai.com/audio.mp3', { sizeBytes: null }), 'metadata_unverified');
  expectQuoteFailure(await resolveStoredAudio('https://media.maxvideoai.com/audio.mp3', { originalName: 'original.m4a' }), 'format_unsupported');
});

test('WAV retains the same valid quote/confirmation path and exact ownership guards', async () => {
  const resolved = await resolveStoredAudio('https://media.maxvideoai.com/audio.wav', { mimeType: 'audio/wav', originalName: 'voice.wav' });
  validateCanonicalGenerationCapabilities(request, candidate, { resolvedReferences: [resolved] });
  assert.equal((await validateConfirmation(resolved)).result.ok, true);
  const changedSource = { ...resolved, storageUrl: 'https://media.maxvideoai.com/another.wav' };
  const mismatch = await validateConfirmation(resolved, [changedSource]);
  assert.equal(mismatch.result.ok, false);
  if (!mismatch.result.ok) assert.equal(mismatch.result.body.error, 'MEDIA_METADATA_UNVERIFIED');
  await assert.rejects(resolveStoredAudio(resolved.storageUrl, { owner: 'another-user' }), /not available/);
});

test('standalone generated audio and its library copy preserve bytes and MP3 naming', async () => {
  const { persistOriginalAudio } = await import('../frontend/src/server/audio/media');
  const { generatedAudioCopyFixture } = await import('./helpers/generated-audio-copy-fixture');
  const bytes = Buffer.concat([Buffer.from([0x49,0x44,0x33,0x04,0,0,0,0,0,0]), Buffer.from('provider-audio-bytes')]);
  const original = await persistOriginalAudio({ userId: actor.userId, jobId: 'audio-job', url: 'https://provider.example/audio' }, {
    fetchBuffer: async () => bytes, detectDuration: async () => 10.371,
    upload: async input => {
      assert.deepEqual(input.data, bytes);
      assert.equal(input.mime, 'audio/mpeg');
      assert.equal(input.fileName, 'audio-job.mp3');
      const key = createStorageFileKey(input);
      return { key, url: `https://media.maxvideoai.com/${key}` };
    },
  });
  assert.match(original.audioUrl, /\/renders\/audio-owner\/.+\.mp3$/);
  const { fixture, copyRemoteMedia } = await generatedAudioCopyFixture(bytes, original.audioUrl);
  const copy = await copyRemoteMedia({ userId: actor.userId, url: original.audioUrl, kind: 'audio', mimeType: original.mimeType, fileName: 'Female demo.v2' });
  assert.deepEqual(fixture.readUrls, [original.audioUrl]);
  assert.equal(fixture.uploads.length, 1);
  assert.deepEqual(fixture.uploads[0]?.data, bytes);
  assert.equal(copy.mimeType, 'audio/mpeg');
  assert.equal(copy.sizeBytes, bytes.length);
  assert.equal(copy.mediaFacts?.source, 'probe');
  assert.equal(copy.mediaFacts?.durationSec, 10.371);
  assert.match(copy.url, /\/media-assets\/audio-owner\/.+\.mp3$/);
  assert.notEqual(copy.url, original.audioUrl);
  const resolved = await resolveStoredAudio(copy.url);
  validateCanonicalGenerationCapabilities(request, candidate, { resolvedReferences: [resolved] });
  assert.equal((await validateConfirmation(resolved)).result.ok, true);
});

test('actual preparation rejects the legacy extension before pricing, wallet or quote writes', async () => {
  const { prepareGenerationForActor } = await import('../frontend/src/server/agent-api/prepare-generation');
  const resolved = await resolveStoredAudio('https://media.maxvideoai.com/media-assets/audio-owner/legacy.mpeg');
  let financialCalls = 0;
  const forbidden = async (): Promise<never> => { financialCalls += 1; throw new Error('No financial action may run for invalid media'); };
  await assert.rejects(prepareGenerationForActor(request, actor, {
    paidGenerationEnabled: () => true, getAccountRestriction: async () => null,
    listPublicEngines: async () => [candidate], resolveGenerationReferences: async () => [resolved],
    resolveRequestExecutability: () => ({ executable: true, reason: 'available' }),
    resolveMembershipPricing: forbidden, priceGeneration: forbidden, getWalletSummary: forbidden,
    withTransaction: forbidden, checkSpendingLimits: forbidden, insertPreparedQuote: forbidden,
    getTrialEligibility: forbidden, checkTrialRisk: forbidden, recordTrialQuotePreparedAudit: forbidden,
    trialRiskContext: { clientIp: null, userAgent: null }, accountUrl: 'https://maxvideoai.com/app', now: () => new Date(),
  }), error => error instanceof Error && 'code' in error && error.code === 'REFERENCE_INVALID' && /format is unsupported/.test(error.message));
  assert.equal(financialCalls, 0);
});
