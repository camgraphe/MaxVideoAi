import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { deriveGenerationAttachmentReferences } from '../frontend/app/api/generate/_lib/attachment-references';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import { validateRequest } from '../frontend/app/api/generate/_lib/validate';
import type { NormalizedAttachment } from '../frontend/app/api/generate/_lib/generation-attachment-types';

const entry = getFalEngineById('flux-3-max')!;
const candidate = { engine: entry.engine, surface: 'video' as const,
  publicModes: entry.modes.map(({ mode }) => mode), modeCaps: Object.fromEntries(entry.modes.map(({ mode, ui }) => [mode, ui])) };
const image = 'https://media.example/repeated.png';

for (const source of ['direct', 'attachments', 'both'] as const) {
  test(`Max reuses one image at two frame positions through the common ${source} pipeline`, () => {
    const request = normalizeGenerationRequest({ surface: 'video', engineId: entry.id, mode: 'ref2v', prompt: 'Return to the opening image.',
      settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9', audio: false, keyframeIndexes: '0,120' },
      references: [image, image].map(url => ({ kind: 'https', url, role: 'reference', mediaKind: 'image' })) });
    validateCanonicalGenerationCapabilities(request, candidate);
    const body = buildPaidVideoRequestBody({ quoteId: 'test-quote', request, engine: entry.engine, canonicalPricing: { membershipTier: 'member' } });
    const references = deriveGenerationAttachmentReferences({ engineId: entry.id, mode: 'ref2v', inputSchema: entry.engine.inputSchema,
      attachments: source === 'direct' ? [] : body.inputs as NormalizedAttachment[],
      referenceImages: source === 'attachments' ? undefined : body.referenceImages });
    assert.deepEqual(references.normalizedReferenceImages, [image, image]);
    assert.equal(validateRequest(entry.id, 'ref2v', { prompt: request.prompt, duration: 5,
      reference_image_urls: references.normalizedReferenceImages, keyframe_indexes: '0,120' }, {
      inputSchema: entry.engine.inputSchema, referenceValuesByField: references.referenceValuesByField,
      referenceMediaItems: references.referenceMediaItems, referenceProvenanceIssues: references.referenceProvenanceIssues,
    }).ok, true);
    const fal = buildFalGenerationRequest({ engineId: entry.id, mode: 'ref2v', prompt: request.prompt, durationSec: 5,
      referenceImages: references.normalizedReferenceImages, extraInputValues: { keyframe_indexes: '0,120' } }, 'blackforestlabs/flux-3-max/text-to-video');
    assert.deepEqual(fal.requestBody.keyframes, [{ image_url: image, frame_index: 0 }, { image_url: image, frame_index: 120 }]);
  });
}

test('non-temporal reference modes retain URL deduplication', () => {
  const references = deriveGenerationAttachmentReferences({ engineId: 'veo-3-1', mode: 'ref2v', attachments: [], referenceImages: [image, image] });
  assert.deepEqual(references.normalizedReferenceImages, [image]);
});
