import assert from 'node:assert/strict';
import test from 'node:test';
import { KLING_V4_FLASH_ENGINE } from '../frontend/src/config/fal-engines/kling-v4-flash';
import { buildKlingV4FlashFalRequest, getKlingV4FlashControlViolation } from '../frontend/src/lib/kling-v4-flash';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { resolveVideoProviderRoutingPlan } from '../frontend/src/server/video-providers/router';
import type { GeneratePayload } from '../frontend/src/lib/fal-types';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';

const candidate = { engine: KLING_V4_FLASH_ENGINE, surface: 'video' as const,
  publicModes: KLING_V4_FLASH_ENGINE.modes, modeCaps: KLING_V4_FLASH_ENGINE.modeCaps! };
const image: ResolvedReference = { assetId: 'owned-image', role: 'reference', slot: 0, mediaKind: 'image',
  storageUrl: 'https://media.maxvideoai.com/user-assets/original.png', mimeType: 'image/png',
  width: 1024, height: 1024, durationSec: null, sizeBytes: 1024 };

test('Kling direct flags cannot reroute Flash or its production V4 precedent to the legacy V3 API', () => {
  for (const engineId of ['kling-v4', 'kling-v4-flash']) {
    for (const mode of ['t2v', 'i2v', 'ref2v']) {
      for (const isAdmin of [false, true]) {
        assert.deepEqual(resolveVideoProviderRoutingPlan({ engineId, mode, isAdmin, env: {
          KLING_DIRECT_ENABLED: 'true', KLING_DIRECT_PUBLIC_ROUTING_ENABLED: 'true',
          KLING_DIRECT_ADMIN_ONLY: 'false', KLING_DIRECT_FALLBACK_TO_FAL_ENABLED: 'true',
          KLING_DIRECT_FALLBACK_ON_CREDITS_DEPLETED_ENABLED: 'true', KLING_DIRECT_ELEMENT_REGISTRATION_ENABLED: 'true',
        } }), { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false });
      }
    }
  }
});

test('Flash preserves every published Fal ratio and duration across canonical and paid request projection', () => {
  for (const mode of ['t2v', 'ref2v'] as const) {
    for (const aspectRatio of mode === 'ref2v' ? ['16:9', '9:16', '1:1', '21:9', 'auto'] : ['16:9', '9:16', '1:1', '21:9']) {
      for (const durationSec of [3, 20]) {
        const request = normalizeGenerationRequest({ surface: 'video', engineId: 'kling-v4-flash', mode,
          prompt: 'x'.repeat(26000), settings: { durationSec, resolution: '720p', aspectRatio },
          references: mode === 'ref2v' ? [{ kind: 'asset', assetId: image.assetId, role: 'reference' }] : [] });
        const resolvedReferences = mode === 'ref2v' ? [image] : [];
        validateCanonicalGenerationCapabilities(request, candidate, { resolvedReferences });
        const body = buildPaidVideoRequestBody({ request, resolvedReferences, engine: candidate.engine,
          quoteId: 'offline-audit', canonicalPricing: { membershipTier: 'member' } });
        const projected = buildKlingV4FlashFalRequest(body as GeneratePayload);
        assert.equal(projected.model, `kling/v4/flash/${mode === 't2v' ? 'text' : 'reference'}-to-video`);
        assert.equal(projected.requestBody.aspect_ratio, aspectRatio);
        assert.equal(projected.requestBody.duration, durationSec);
        assert.equal(projected.requestBody.resolution, '720p');
        assert.equal(projected.requestBody.prompt, request.prompt);
        assert.deepEqual(projected.requestBody.image_urls, mode === 'ref2v' ? [image.storageUrl] : undefined);
      }
    }
  }
});

test('Flash rejects unoffered shot, negative-prompt, format and voice controls before provider projection', () => {
  for (const settings of [
    { negativePrompt: 'blur' }, { multiPrompt: [{ prompt: 'A shot', duration: 5 }] },
    { outputFormat: 'webm' }, { fps: 24 }, { seed: 42 }, { cfgScale: 0.5 },
    { audio: false }, { keepAudio: true }, { voiceIds: ['voice'] },
  ]) {
    assert.throws(() => {
      const request = normalizeGenerationRequest({ surface: 'video', engineId: 'kling-v4-flash', mode: 't2v',
        prompt: 'A scene', settings: { durationSec: 5, resolution: '720p', ...settings }, references: [] });
      validateCanonicalGenerationCapabilities(request, candidate);
    }, JSON.stringify(settings));
  }
  for (const controls of [{ negativePrompt: 'blur' }, { multiPrompt: [{ prompt: 'A shot', duration: 5 }] }, { audio: false }]) {
    assert.ok(getKlingV4FlashControlViolation('t2v', controls));
  }
});
