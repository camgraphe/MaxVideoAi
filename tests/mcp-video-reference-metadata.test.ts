import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { ensureExecutableFfmpegPath } from '../frontend/server/ffmpeg-runtime';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { createStoreVideoUploadService } from '../frontend/src/server/uploads/store-media-upload';
import { resolveOwnedReferenceAssetForActor } from '../frontend/src/server/agent-api/reference-assets';
import { readGenerationPricing } from '../frontend/src/server/agent-api/generation-pricing-read';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import type { AgentPrincipal } from '../frontend/src/server/agent-api/principal';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';

const execute = promisify(execFile);
const principal: AgentPrincipal = {
  userId: 'reference-test-owner', clientId: 'reference-test-client', authMethod: 'oauth', emailVerified: true,
};
const assetId = `ma_${'a'.repeat(32)}`;

function candidate(engineId: string): AgentPublicGenerationEngine {
  const entry = listFalEngines().find((engine) => engine.id === engineId)!;
  return { engine: entry.engine, surface: 'video', publicModes: ['ref2v'],
    modeCaps: Object.fromEntries(entry.modes.map((mode) => [mode.mode, mode.ui])) };
}

// Real bytes, probe, upload orchestration, asset resolver and quote validation.
// Only storage/database effects and pricing are replaced; no provider is called.
test('imported portrait MP4s at 24/30 fps retain measured geometry through H3 reference quote validation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mcp-video-reference-'));
  try {
    const binary = await ensureExecutableFfmpegPath(ffmpeg.path);
    for (const fps of [24, 30]) {
      const fileName = `reference-${fps}.mp4`;
      const output = join(directory, fileName);
      await execute(binary, ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=black:s=720x1280:r=${fps}`,
        '-t', '14', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'ultrafast', output],
      { timeout: 20_000, maxBuffer: 1024 * 1024 });
      const bytes = await readFile(output);
      let canonical: Record<string, unknown> | undefined;
      let legacy: Record<string, unknown> | undefined;
      const store = createStoreVideoUploadService({
        async uploadFileBuffer(input) {
          assert.equal(input.acl, null);
          assert.equal(input.cacheControl, 'private, no-store');
          const key = `user-assets/by-content/test/${fileName}`;
          await input.beforeUpload?.(key);
          return { key, url: `https://cdn.maxvideoai.com/${key}` };
        },
        async createUploadVideoThumbnail() { return null; },
        async recordUserAsset(input) { legacy = input; return 'legacy-test-id'; },
        async ensureReusableAsset(input) {
          canonical = input;
          return { publicId: assetId } as never;
        },
        async claimStorageObjectProducer({ objectKey }) {
          return { objectKey, claimId: 'test-claim', leaseExpiresAt: new Date('2030-01-01') };
        },
        async renewStorageObjectProducer({ claim }) { return claim; },
        async settleStorageObjectProducer() {},
        scheduleProducerHeartbeat() { return () => {}; },
      });
      const stored = await store({ userId: principal.userId, fileName, declaredMime: 'video/mp4', bytes,
        referenceEligibility: 'mcp', storageAcl: null, storageCacheControl: 'private, no-store' });
      assert.ok(canonical);
      const persisted = {
        id: 'internal-test-id', public_id: stored.assetId, user_id: principal.userId,
        kind: canonical.kind, url: canonical.url, mime_type: canonical.mimeType,
        size_bytes: canonical.sizeBytes, width: canonical.width ?? null, height: canonical.height ?? null,
        status: 'ready', deleted_at: null,
        metadata: { ...(canonical.metadata as object), durationSec: canonical.durationSec },
      };
      const owned = await resolveOwnedReferenceAssetForActor(principal, stored.assetId, {
        executor: { async query<T>(_sql: string, params: readonly unknown[] = []) {
          assert.deepEqual(params, [assetId, principal.userId]);
          return [persisted] as T[];
        } },
      });
      const video: ResolvedReference = { ...owned, role: 'reference' };
      const image: ResolvedReference = {
        assetId: `ma_${'b'.repeat(32)}`, role: 'reference', mediaKind: 'image', width: 941, height: 1672,
        mimeType: 'image/png', originalName: 'reference.png', sizeBytes: 1000,
        storageUrl: 'https://cdn.maxvideoai.com/user-assets/reference.png', durationSec: null,
      };
      for (const engineId of ['wan-3', 'minimax-h3']) {
        for (const references of [[video], [video, image]]) {
          const request: CanonicalGenerationRequest = {
            schemaVersion: 1, surface: 'video', engineId, mode: 'ref2v', prompt: 'Follow the reference motion.',
            settings: { durationSec: 14, resolution: engineId === 'minimax-h3' ? '2K' : '720p',
              aspectRatio: '9:16', ...(engineId === 'minimax-h3' ? { fps: 24, promptExpansionMode: 'disabled' } : {}) },
            references: references.map(({ assetId, role }) => ({ kind: 'asset', assetId, role })), outputCount: 1,
          };
          let priced = 0;
          await readGenerationPricing(request, principal, {
            listPublicEngines: async () => [candidate(engineId)],
            resolveGenerationReferences: async () => references,
            resolveMembershipPricing: async () => ({ tier: 'member', source: 'app_receipts_rolling_30d',
              spent30Cents: 0, thresholdCents: 0, discountPercent: 0 }),
            priceGeneration: async (_request, membershipTier, context) => {
              priced++;
              assert.equal(context?.resolvedReferences?.[0]?.durationSec, 14);
              return { priceCents: 100, currency: 'USD', membershipTier,
                pricingSnapshot: { totalCents: 100, currency: 'USD', membershipTier } };
            },
          });
          assert.equal(priced, 1, `${engineId}: ${fps} fps, ${references.length} references`);
        }
      }
      for (const dimensions of [stored, legacy, canonical, stored.mediaFacts]) {
        assert.equal(dimensions?.width, 720);
        assert.equal(dimensions?.height, 1280);
      }
      assert.equal(stored.mediaFacts?.hasAudio, false);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
