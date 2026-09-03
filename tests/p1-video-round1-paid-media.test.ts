import assert from 'node:assert/strict';
import test from 'node:test';

import { getFalEngineById } from '../frontend/src/config/falEngines';
import { validateCanonicalGenerationCapabilities, GenerationCapabilityError } from '../frontend/src/server/agent-api/generation-capability-validation';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { submitReservedPaidGeneration, type PaidGenerationExecution } from '../frontend/src/server/agent-api/paid-generation-execution';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';
import { processAndValidateGenerationAttachments } from '../frontend/app/api/generate/_lib/generation-attachment-processing';
import { validateGenerationMediaConstraints } from '../frontend/app/api/generate/_lib/generation-media-constraints';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';

const entry = getFalEngineById('gemini-omni-flash');
assert.ok(entry);
const engine = entry.engine;

const candidate: AgentPublicGenerationEngine = {
  engine,
  surface: 'video',
  publicModes: ['fl2v', 'extend'],
  modeCaps: Object.fromEntries(
    entry.modes
      .filter(({ mode }) => mode === 'fl2v' || mode === 'extend')
      .map(({ mode, ui }) => [mode, ui]),
  ),
};

function resolved(input: {
  assetId: string;
  role: 'first_frame' | 'last_frame' | 'source';
  mediaKind: 'image' | 'video';
  storageUrl: string;
  slot?: number;
}): ResolvedReference {
  return {
    ...input,
    width: 1280,
    height: 720,
    durationSec: input.mediaKind === 'video' ? 8 : null,
    mimeType: input.mediaKind === 'video' ? 'video/mp4' : 'image/png',
    sizeBytes: input.mediaKind === 'video' ? 8_192 : 4_096,
    originalName: input.mediaKind === 'video' ? 'source.mp4' : `${input.role}.png`,
  };
}

const first = resolved({
  assetId: 'ma_11111111111111111111111111111111',
  role: 'first_frame', mediaKind: 'image',
  storageUrl: 'https://cdn.maxvideoai.com/first.png',
});
const last = resolved({
  assetId: 'ma_22222222222222222222222222222222',
  role: 'last_frame', mediaKind: 'image',
  storageUrl: 'https://cdn.maxvideoai.com/last.png',
});

const request = normalizeGenerationRequest({
  schemaVersion: 1,
  surface: 'video',
  engineId: engine.id,
  mode: 'fl2v',
  prompt: 'A camera move connects the two verified frames.',
  settings: { durationSec: 6, resolution: '720p', aspectRatio: '16:9' },
  references: [
    { kind: 'asset', assetId: first.assetId, role: first.role },
    { kind: 'asset', assetId: last.assetId, role: last.role },
  ],
  outputCount: 1,
});

function execution(): PaidGenerationExecution {
  return {
    surface: 'video',
    quoteId: 'quote_round1_owned_media',
    userId: 'owned-media-user',
    request,
    resolvedReferences: [first, last],
    engine,
    canonicalPricing: { membershipTier: 'member', totalCents: 100, currency: 'USD' },
    trustedInitialState: {
      kind: 'created', jobId: 'quote_round1_owned_media', walletChargeReserved: true,
    },
  };
}

test('paid video body preserves owned asset identity and trusted media metadata', () => {
  const body = buildPaidVideoRequestBody(execution());
  assert.deepEqual(body.inputs, [
    {
      assetId: first.assetId,
      name: 'first_frame.png', type: 'image/png', size: 4_096,
      kind: 'image', slotId: 'image_url', url: first.storageUrl,
      width: 1280, height: 720,
    },
    {
      assetId: last.assetId,
      name: 'last_frame.png', type: 'image/png', size: 4_096,
      kind: 'image', slotId: 'end_image_url', url: last.storageUrl,
      width: 1280, height: 720,
    },
  ]);
});

test('paid continuation carries the server-owned snapshot into real attachment processing without a post-reservation database lookup', async () => {
  let mediaQueries = 0;
  const result = await submitReservedPaidGeneration(execution(), {
    async executeVideo(options) {
      const trustedResolvedReferences = (options as unknown as {
        trustedResolvedReferences?: readonly ResolvedReference[];
      }).trustedResolvedReferences;
      const processed = await processAndValidateGenerationAttachments({
        rawInputs: options.body.inputs,
        userId: options.userId,
        engineId: options.engine.id,
        mode: 'fl2v',
        inputSchema: options.engine.inputSchema,
        trustedResolvedReferences,
        mediaConstraintDeps: {
          queryFn: async () => {
            mediaQueries += 1;
            throw new Error('paid continuation must use its pre-reservation trusted snapshot');
          },
        },
      });
      return processed.ok
        ? { body: { ok: true, status: 'pending' } }
        : { status: processed.status, body: processed.body };
    },
    async executeImage() {
      throw new Error('not an image request');
    },
    async ensureKnownRejectionRefund() {
      return true;
    },
  });

  assert.deepEqual(result, { kind: 'accepted' });
  assert.equal(mediaQueries, 0);
});

test('Gemini owned fl2v and extend references fail closed without trusted stored dimensions in MCP validation', () => {
  assert.throws(
    () => validateCanonicalGenerationCapabilities(request, candidate, {
      resolvedReferences: [{ ...first, width: null }, last],
    }),
    (error) => error instanceof GenerationCapabilityError && error.kind === 'reference_invalid',
  );

  const source = resolved({
    assetId: 'ma_33333333333333333333333333333333',
    role: 'source', mediaKind: 'video',
    storageUrl: 'https://cdn.maxvideoai.com/source.mp4',
  });
  const extend = normalizeGenerationRequest({
    schemaVersion: 1, surface: 'video', engineId: engine.id, mode: 'extend',
    prompt: 'Continue the verified source clip.',
    settings: { durationSec: 6, resolution: '720p', aspectRatio: '16:9' },
    references: [{ kind: 'asset', assetId: source.assetId, role: 'source' }],
    outputCount: 1,
  });
  assert.throws(
    () => validateCanonicalGenerationCapabilities(extend, candidate, {
      resolvedReferences: [{ ...source, height: null }],
    }),
    (error) => error instanceof GenerationCapabilityError && error.kind === 'reference_invalid',
  );
});

test('website owned-media validation requires reliable stored dimensions before quoting', async () => {
  const attachments = [{
    assetId: first.assetId, name: 'first_frame.png', type: 'image/png', size: 4_096,
    kind: 'image' as const, slotId: 'image_url', url: first.storageUrl,
  }];
  const result = await validateGenerationMediaConstraints({
    engineId: engine.id,
    mode: 'fl2v',
    userId: 'owned-media-user',
    inputSchema: engine.inputSchema,
    attachments,
    referenceMediaItems: [{ fieldId: 'image_url', kind: 'image', url: first.storageUrl }],
    deps: {
      queryFn: async <T>() => [{
        asset_id: first.assetId, url: first.storageUrl, origin_url: null,
        original_name: 'first_frame.png', mime_type: 'image/png', size_bytes: 4_096,
        width: null, height: 720,
      }] as T[],
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.body.error, 'MEDIA_DIMENSIONS_UNVERIFIED');
});

test('Gemini workspace preflight rejects missing stored dimensions before pricing', async () => {
  let pricingCalls = 0;
  const result = await resolveMediaAwarePreflight({
    request: {
      engine: engine.id,
      mode: 'fl2v',
      durationSec: 6,
      resolution: '720p',
      aspectRatio: '16:9',
      fps: 24,
      user: { memberTier: 'Member' },
      inputs: [
        { assetId: first.assetId, slotId: 'image_url', kind: 'image', url: first.storageUrl },
        { assetId: last.assetId, slotId: 'end_image_url', kind: 'image', url: last.storageUrl },
      ],
    },
    userId: 'owned-media-user',
  }, {
    getConfiguredEngineFn: async () => engine,
    computeConfiguredPreflightFn: async () => {
      pricingCalls += 1;
      throw new Error('unverified media must not reach pricing');
    },
    mediaConstraintDeps: {
      queryFn: async <T>() => [
        {
          asset_id: first.assetId, url: first.storageUrl, origin_url: null,
          original_name: 'first_frame.png', mime_type: 'image/png', size_bytes: 4_096,
          width: null, height: 720,
        },
        {
          asset_id: last.assetId, url: last.storageUrl, origin_url: null,
          original_name: 'last_frame.png', mime_type: 'image/png', size_bytes: 4_096,
          width: 1280, height: 720,
        },
      ] as T[],
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error?.code, 'MEDIA_DIMENSIONS_UNVERIFIED');
  assert.equal(pricingCalls, 0);
});
