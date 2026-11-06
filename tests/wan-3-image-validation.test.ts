import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { validateGenerationMediaConstraints, type StoredMediaMetadataRow } from '../frontend/app/api/generate/_lib/generation-media-constraints';
import { getMediaInputEligibility } from '../frontend/lib/media-input-eligibility';
import { mediaInputEligibilityMessage } from '../frontend/components/library/media-input-eligibility-copy';
import type { Mode } from '../frontend/types/engines';
import { GenerationCapabilityError, validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateEngineImageFile } from '../frontend/components/asset-dropzone/asset-dropzone-helpers';
import { getLocalizedAssetDropzoneCopy } from '../frontend/lib/ltx-localization';
import { validateGenerationPricingCapabilities } from '../frontend/src/server/agent-api/generation-pricing-read';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import { projectAgentModelModeDetails } from '../frontend/src/server/agent-api/model-details';

const url = 'https://media.example/owned-original.png';
const row: StoredMediaMetadataRow = { asset_id: 'image-1', url, origin_url: null,
  original_name: 'original.png', mime_type: 'image/png', size_bytes: 27692, width: 363, height: 119 };

for (const engineId of ['wan-3', 'wan-3-prime'] as const) {
  const engine = getFalEngineById(engineId)!.engine;
  test(`${engineId} discovery advertises owned images and the same minimum before quoting`, () => {
    const entry = getFalEngineById(engineId)!;
    const candidate = { engine, surface: 'video' as const,
      modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])) };
    for (const mode of ['i2v', 'ref2v', 'v2v', 'extend'] as const) {
      const images = projectAgentModelModeDetails(candidate, mode).references.filter(field => field.type === 'image');
      assert.ok(images.length > 0);
      for (const image of images) {
        assert.equal(image.minImageSidePx, 240);
        assert.equal(image.assetRequired, true);
      }
    }
  });
  async function validate(fieldId: string, mode: Mode, rows: StoredMediaMetadataRow[]) {
    return validateGenerationMediaConstraints({ engineId, mode, userId: 'owner', inputSchema: engine.inputSchema,
      attachments: [{ name: 'original.png', type: 'image/png', size: 1, kind: 'image', slotId: fieldId,
        url, assetId: 'image-1', width: 1920, height: 1080 }],
      referenceMediaItems: [{ fieldId, kind: 'image', url }],
      deps: { queryFn: async <T>(sql: string, values?: readonly unknown[]) => {
        assert.match(sql, /user_id = \$1/);
        assert.equal(values?.[0], 'owner');
        return rows as T[];
      } },
    });
  }

  test(`${engineId} rejects undersized originals in every image role before funding`, async () => {
    for (const [field, mode] of [['start_image_url', 'i2v'], ['end_image_url', 'i2v'],
      ['reference_image_urls', 'ref2v'], ['reference_image_urls', 'v2v'], ['reference_image_urls', 'extend']] as const) {
      for (const [width, height] of [[363, 119], [119, 363], [239, 240], [240, 239]]) {
        const result = await validate(field, mode, [{ ...row, width, height }]);
        assert.equal(result.ok, false, `${field}: ${width}x${height}`);
        if (result.ok) continue;
        assert.equal(result.body.error, 'MEDIA_DIMENSIONS_TOO_SMALL');
        assert.equal(result.body.minimumSidePx, 240);
        assert.equal(result.body.actualWidth, width);
        assert.equal(result.body.actualHeight, height);
        assert.match(result.body.message, /larger image|another image/);
        assert.match(result.body.message, /No credits were charged/);
      }
      assert.equal((await validate(field, mode, [{ ...row, width: 240, height: 240 }])).ok, true);
      assert.equal((await validate(field, mode, [{ ...row, width: 1280, height: 720 }])).ok, true);
    }
  });

  test(`${engineId} never accepts client dimensions when trusted metadata is absent`, async () => {
    for (const rows of [[], [{ ...row, width: null, height: null }], [{ ...row, size_bytes: null }]]) {
      const result = await validate('reference_image_urls', 'ref2v', rows);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.match(result.body.error, /UNVERIFIED/);
        assert.match(result.body.message, /Upload|upload/);
        assert.match(result.body.message, /No credits were charged/);
      }
    }
  });

  test(`${engineId} library selection identifies the minimum and a useful next action`, () => {
    const field = engine.inputSchema!.optional!.find(field => field.id === 'reference_image_urls')!;
    const result = getMediaInputEligibility({ engine, field, mode: 'ref2v', asset: {
      kind: 'image', url, mime: 'image/png', size: 27692, width: 363, height: 119,
    } });
    assert.equal(result.status, 'blocked');
    assert.equal(result.minimumImageSidePx, 240);
    const message = mediaInputEligibilityMessage(result, 'fr') ?? '';
    assert.match(message, /363.*119/);
    assert.match(message, /240/);
    assert.match(message, /plus grande|autre image/);
    assert.match(message, /Aucun crédit n’a été débité/);
  });

  test(`${engineId} file selection gives localized guidance before upload`, async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap');
    let dimensions = { width: 363, height: 119 };
    let disposed = 0;
    Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true,
      value: async () => ({ ...dimensions, close() { disposed++; } }) });
    try {
      for (const [locale, noCharge] of [['en', /No credits were charged/],
        ['fr', /Aucun crédit n’a été débité/], ['es', /No se han descontado créditos/]] as const) {
        const result = await validateEngineImageFile({ file: new File(['image'], 'original.png', { type: 'image/png' }),
          acceptFormats: ['png'], minimumSidePx: 240, engineLabel: engine.label, engineId, locale,
          assetCopy: getLocalizedAssetDropzoneCopy(locale) });
        assert.equal(result.ok, false);
        if (!result.ok) {
          assert.match(result.message, /363.*119/);
          assert.match(result.message, /240/);
          assert.match(result.message, noCharge);
        }
      }
      dimensions = { width: 240, height: 240 };
      const valid = await validateEngineImageFile({ file: new File(['image'], 'original.png', { type: 'image/png' }),
        acceptFormats: ['png'], minimumSidePx: 240, engineLabel: engine.label, engineId, locale: 'fr',
        assetCopy: getLocalizedAssetDropzoneCopy('fr') });
      assert.deepEqual(valid, { ok: true, dimensions });
      assert.equal(disposed, 4);
    } finally {
      if (original) Object.defineProperty(globalThis, 'createImageBitmap', original);
      else Reflect.deleteProperty(globalThis, 'createImageBitmap');
    }
  });

  test(`${engineId} executable agent quotes reject small or unverified images before reservation`, () => {
    const entry = getFalEngineById(engineId)!;
    const candidate = { engine, surface: 'video' as const, publicModes: engine.modes,
      modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])) };
    const request = normalizeGenerationRequest({ surface: 'video', engineId, mode: 'ref2v', prompt: 'Animate this scene.',
      settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9', audio: false },
      references: [{ kind: 'asset', assetId: 'image-1', role: 'reference' }], outputCount: 1 });
    for (const [width, height, error] of [[363, 119, 'image_dimensions_too_small'],
      [null, null, 'dimensions_unverified'], [240, 240, null]] as const) {
      const run = () => validateCanonicalGenerationCapabilities(request, candidate, { resolvedReferences: [{
        assetId: 'image-1', role: 'reference', mediaKind: 'image', storageUrl: url,
        width, height, durationSec: null, mimeType: 'image/png', sizeBytes: 27692,
      }] });
      if (error) assert.throws(run, actual => actual instanceof GenerationCapabilityError && actual.referenceFailure === error);
      else assert.doesNotThrow(run);
    }
    for (const sizeBytes of [undefined, 0, Number.NaN]) {
      assert.throws(() => validateCanonicalGenerationCapabilities(request, candidate, { resolvedReferences: [{
        assetId: 'image-1', role: 'reference', mediaKind: 'image', storageUrl: url,
        width: 512, height: 512, durationSec: null, mimeType: 'image/png', sizeBytes,
      }] }), actual => actual instanceof GenerationCapabilityError && actual.referenceFailure === 'metadata_unverified');
    }
    const external = normalizeGenerationRequest({ ...request,
      references: [{ kind: 'https', url, role: 'reference', mediaKind: 'image' }] });
    assert.throws(() => validateCanonicalGenerationCapabilities(external, candidate),
      actual => actual instanceof GenerationCapabilityError && actual.referenceFailure === 'dimensions_unverified');
    assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(external, candidate, { allowUnverifiedReferenceDuration: true }));
    // Preliminary shape checks are followed by owned metadata resolution before an executable quote.
    assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(request, candidate));
    assert.throws(() => validateGenerationPricingCapabilities(external, candidate), actual => {
      assert.ok(actual instanceof AgentApiError);
      assert.match(actual.message, /240/);
      assert.match(actual.message, /No credits were charged/);
      return true;
    });
    assert.throws(() => validateGenerationPricingCapabilities(request, candidate, [{
      assetId: 'image-1', role: 'reference', mediaKind: 'image', storageUrl: url,
      width: 363, height: 119, durationSec: null, mimeType: 'image/png', sizeBytes: 27692,
    }]), actual => {
      assert.ok(actual instanceof AgentApiError);
      assert.match(actual.message, /363.*119/);
      assert.match(actual.message, /240/);
      assert.match(actual.message, /No credits were charged/);
      return true;
    });
  });
}
