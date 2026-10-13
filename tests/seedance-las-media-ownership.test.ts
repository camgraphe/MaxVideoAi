import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { ENV } from '../frontend/src/lib/env';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import type { PreflightMediaInput } from '../frontend/types/engines';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateNormalizedGenerationAttachments } from '../frontend/app/api/generate/_lib/normalized-generation-attachment-validation';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';

const source = 'https://media.maxvideoai.com/owned/original.mp4';
const origin = 'https://example.test/mutable-origin.mp4';
const engine = getFalEngineById('seedance-2-5')!.engine;
const configured = { BYTEPLUS_ARK_ENABLED: '1', BYTEPLUS_ARK_API_KEY: 'fixture-ark', SEEDANCE_2_5_BYTEPLUS_ENABLED: '1', SEEDANCE_2_5_PROVIDER: 'byteplus_modelark', SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY: '0', SEEDANCE_2_5_BYTEPLUS_MODES: 't2v,i2v,ref2v,v2v,extend', SEEDANCE_2_5_LAS_ENABLED: '1', BYTEPLUS_LAS_API_KEY: 'fixture-las' };
const previous = new Map<string, unknown>();
before(() => { for (const [key, value] of Object.entries(configured)) { previous.set(key, (ENV as unknown as Record<string, unknown>)[key]); (ENV as unknown as Record<string, unknown>)[key] = value; } });
after(() => { for (const [key, value] of previous) (ENV as unknown as Record<string, unknown>)[key] = value; });

const ownedSource = { asset_id: 'source', url: source, origin_url: origin, original_name: 'original.mp4', mime_type: 'video/mp4', size_bytes: 1000, duration_sec: 4.25, width: 1280, height: 720 };
async function quote(inputs: PreflightMediaInput[], rows: unknown[], mode: 'v2v' | 'ref2v' = 'v2v') {
  let quoted = 0;
  let duration: number | undefined;
  const response = await resolveMediaAwarePreflight({ userId: 'current-owner', request: { engine: engine.id, mode, durationSec: 4, resolution: '720p', aspectRatio: '16:9', fps: 24, inputs, user: { memberTier: 'Member' } } }, {
    getConfiguredEngineFn: async () => engine,
    computeConfiguredPreflightFn: async (_request, options) => { quoted += 1; duration = options?.trustedMediaPricingFacts?.inputVideoDurationSec; return { ok: true, total: 123 }; },
    mediaConstraintDeps: { queryFn: async <T>(sql: string, values?: readonly unknown[]) => {
      assert.match(sql, /WHERE user_id = \$1/); assert.equal(values?.[0], 'current-owner'); return rows as T[];
    } },
  });
  return { response, quoted, duration };
}

test('LAS source origin aliases are rejected before quoting while stored originals keep exact duration', async () => {
  const alias = await quote([{ assetId: 'source', slotId: 'video_url', kind: 'video', url: origin }], [ownedSource]);
  assert.equal(alias.response.ok, false); assert.equal(alias.response.error?.code, 'MEDIA_METADATA_UNVERIFIED'); assert.equal(alias.quoted, 0);
  const original = await quote([{ assetId: 'source', slotId: 'video_url', kind: 'video', url: source }], [ownedSource]);
  assert.equal(original.response.ok, true); assert.equal(original.quoted, 1); assert.equal(original.duration, 4.25);
});

test('LAS rejects foreign image references instead of skipping ownership verification', async () => {
  const result = await quote([{ assetId: 'source', slotId: 'video_url', kind: 'video', url: source },
    { assetId: 'foreign-image', slotId: 'image_urls', kind: 'image', url: 'https://example.test/foreign.png' }], [ownedSource]);
  assert.equal(result.response.ok, false); assert.equal(result.response.error?.code, 'MEDIA_METADATA_UNVERIFIED');
  assert.equal(result.response.error?.field, 'image_urls'); assert.equal(result.quoted, 0);
});

test('LAS cannot substitute another asset ID while ModelArk reference aliases preserve their existing behavior', async () => {
  const mismatched = await quote([{ assetId: 'different-asset', slotId: 'video_url', kind: 'video', url: source }], [ownedSource]);
  assert.equal(mismatched.response.ok, false); assert.equal(mismatched.quoted, 0);
  const modelArk = await quote([{ assetId: 'source', slotId: 'video_urls', kind: 'video', url: origin }], [ownedSource], 'ref2v');
  assert.equal(modelArk.response.ok, true); assert.equal(modelArk.duration, 4.25);
});

for (const [kind, slotId, mime, suffix] of [['image', 'image_urls', 'image/png', 'png'], ['audio', 'audio_urls', 'audio/mpeg', 'mp3']] as const) {
  test(`LAS ${kind} references must use the owned stored original, not an origin alias`, async () => {
    const url = `https://media.maxvideoai.com/owned/reference.${suffix}`;
    const alias = `https://example.test/mutable-reference.${suffix}`;
    const row = { asset_id: 'reference', url, origin_url: alias, original_name: `reference.${suffix}`, mime_type: mime, size_bytes: 1000, duration_sec: kind === 'audio' ? 2 : null, width: kind === 'image' ? 512 : null, height: kind === 'image' ? 512 : null };
    const result = await quote([{ assetId: 'source', slotId: 'video_url', kind: 'video', url: source }, { assetId: 'reference', slotId, kind, url: alias }], [ownedSource, row]);
    assert.equal(result.response.ok, false); assert.equal(result.response.error?.field, slotId); assert.equal(result.quoted, 0);
    const exact = await quote([{ assetId: 'source', slotId: 'video_url', kind: 'video', url: source }, { assetId: 'reference', slotId, kind, url }], [ownedSource, row]);
    assert.equal(exact.response.ok, true); assert.equal(exact.duration, 4.25);
  });
}

test('MCP Edit projects owned image asset IDs into the exact image reference slots in request order', async () => {
  const records: ResolvedReference[] = [
    { assetId: 'source', role: 'source', mediaKind: 'video', storageUrl: source, mimeType: 'video/mp4', sizeBytes: 1000, originalName: 'source.mp4', width: 1280, height: 720, durationSec: 4.25 },
    { assetId: 'image-a', role: 'reference', slot: 0, mediaKind: 'image', storageUrl: 'https://media.maxvideoai.com/owned/a.png', mimeType: 'image/png', sizeBytes: 1000, originalName: 'a.png', width: 512, height: 512, durationSec: null },
    { assetId: 'image-b', role: 'reference', slot: 1, mediaKind: 'image', storageUrl: 'https://media.maxvideoai.com/owned/b.png', mimeType: 'image/png', sizeBytes: 1000, originalName: 'b.png', width: 512, height: 512, durationSec: null },
  ];
  const request = normalizeGenerationRequest({ surface: 'video', engineId: engine.id, mode: 'v2v', prompt: 'Replace the background using these images.',
    settings: { durationSec: 4, resolution: '720p', aspectRatio: '16:9' }, references: records.map(({ assetId, role, slot }) => ({ kind: 'asset', assetId, role, ...(slot === undefined ? {} : { slot }) })), outputCount: 1 });
  const body = buildPaidVideoRequestBody({ engine, quoteId: 'quote-owned', request, resolvedReferences: [...records].reverse(), canonicalPricing: { membershipTier: 'member' } });
  const inputs = body.inputs as Array<{ name: string; type: string; size: number; assetId: string; slotId: string; kind: 'image' | 'video'; url: string }>;
  assert.deepEqual(inputs.map(({ assetId, slotId, url }) => ({ assetId, slotId, url })), [
    { assetId: 'source', slotId: 'video_url', url: source },
    { assetId: 'image-a', slotId: 'image_urls', url: 'https://media.maxvideoai.com/owned/a.png' },
    { assetId: 'image-b', slotId: 'image_urls', url: 'https://media.maxvideoai.com/owned/b.png' },
  ]);
  const validated = await validateNormalizedGenerationAttachments({ engineId: engine.id, mode: 'v2v', userId: 'current-owner', inputSchema: engine.inputSchema,
    attachments: inputs, referenceImages: body.referenceImages, trustedResolvedReferences: records });
  assert.equal(validated.ok, true, JSON.stringify(validated));
  if (validated.ok) assert.deepEqual(validated.references.normalizedReferenceImages, ['https://media.maxvideoai.com/owned/a.png', 'https://media.maxvideoai.com/owned/b.png']);
});
