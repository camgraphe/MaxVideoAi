import assert from 'node:assert/strict';
import test from 'node:test';

import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import { resolveGenerationReferences } from '../frontend/src/server/agent-api/resolve-generation-references';
import {
  submitReservedPaidGeneration,
  type PaidGenerationExecution,
} from '../frontend/src/server/agent-api/paid-generation-execution';
import type { EngineCaps } from '../frontend/types/engines';

const principal: AgentPrincipal = {
  userId: 'user-a',
  clientId: 'claude-client',
  emailVerified: true,
  authMethod: 'oauth',
};
const request: CanonicalGenerationRequest = {
  schemaVersion: 1,
  surface: 'video',
  engineId: 'reference-video',
  mode: 'i2v',
  prompt: 'Animate the private reference',
  settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9' },
  references: [{ kind: 'asset', assetId: 'asset-image-1', role: 'source' }],
  outputCount: 1,
};
const engine = {
  id: 'reference-video',
  label: 'Reference Video',
  provider: 'test',
  status: 'live',
  latencyTier: 'standard',
  modes: ['i2v'],
  maxDurationSec: 5,
  resolutions: ['720p'],
  aspectRatios: ['16:9'],
  fps: [24],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: { promptMaxChars: 12_000 },
  updatedAt: '2026-08-24T00:00:00.000Z',
  ttlSec: 600,
  availability: 'available',
} as EngineCaps;

test('owned asset references resolve to private internal URLs without changing the quote request', async () => {
  const calls: Array<{ userId: string; assetId: string }> = [];
  const resolved = await resolveGenerationReferences(request, principal, {
    async resolveOwnedReferenceAsset(currentPrincipal, assetId) {
      calls.push({ userId: currentPrincipal.userId, assetId });
      return {
        assetId,
        mediaKind: 'image',
        storageUrl: 'https://media.maxvideoai.com/private/reference.png',
        width: 1280,
        height: 720,
        mimeType: 'image/png',
      };
    },
  });

  assert.deepEqual(calls, [{ userId: 'user-a', assetId: 'asset-image-1' }]);
  assert.deepEqual(resolved, [{
    assetId: 'asset-image-1',
    role: 'source',
    mediaKind: 'image',
    storageUrl: 'https://media.maxvideoai.com/private/reference.png',
    width: 1280,
    height: 720,
    mimeType: 'image/png',
  }]);
  assert.deepEqual(request.references, [{ kind: 'asset', assetId: 'asset-image-1', role: 'source' }]);
});

test('wrong-user and stale assets fail before pricing or provider submission', async () => {
  await assert.rejects(
    resolveGenerationReferences(request, principal, {
      async resolveOwnedReferenceAsset() {
        throw new AgentApiError('REFERENCE_NOT_FOUND', 'Reference image not found.');
      },
    }),
    (error: unknown) => error instanceof AgentApiError && error.code === 'REFERENCE_NOT_FOUND',
  );
});

test('paid execution materializes a verified asset URL only in the ephemeral provider body', async () => {
  const execution: PaidGenerationExecution = {
    surface: 'video',
    quoteId: '123e4567-e89b-42d3-a456-426614174000',
    userId: 'user-a',
    request,
    resolvedReferences: [{
      assetId: 'asset-image-1',
      role: 'source',
      mediaKind: 'image',
      storageUrl: 'https://media.maxvideoai.com/private/reference.png',
      width: 1280,
      height: 720,
      mimeType: 'image/png',
    }],
    engine,
    canonicalPricing: { membershipTier: 'member' },
    trustedInitialState: {
      kind: 'created',
      jobId: '123e4567-e89b-42d3-a456-426614174000',
      walletChargeReserved: true,
    },
  };
  let providerBody: Record<string, unknown> | null = null;
  const outcome = await submitReservedPaidGeneration(execution, {
    async executeVideo(options) {
      providerBody = options.body;
      return { body: { ok: true, status: 'pending' } };
    },
    async executeImage() { throw new Error('wrong surface'); },
  });

  assert.deepEqual(outcome, { kind: 'accepted' });
  assert.equal(providerBody?.imageUrl, 'https://media.maxvideoai.com/private/reference.png');
  assert.equal(JSON.stringify(providerBody).includes('asset-image-1'), false);
  assert.deepEqual(request.references, [{ kind: 'asset', assetId: 'asset-image-1', role: 'source' }]);
});

test('provider submission fails closed when an asset was not resolved during confirmation', async () => {
  const execution = {
    surface: 'video' as const,
    quoteId: '123e4567-e89b-42d3-a456-426614174000',
    userId: 'user-a',
    request,
    resolvedReferences: [],
    engine,
    canonicalPricing: { membershipTier: 'member' },
    trustedInitialState: {
      kind: 'created' as const,
      jobId: '123e4567-e89b-42d3-a456-426614174000',
      walletChargeReserved: true as const,
    },
  };
  let providerCalls = 0;
  await assert.rejects(
    submitReservedPaidGeneration(execution, {
      async executeVideo() { providerCalls += 1; return { body: { ok: true } }; },
      async executeImage() { throw new Error('wrong surface'); },
    }),
    /resolved reference/i,
  );
  assert.equal(providerCalls, 0);
});
