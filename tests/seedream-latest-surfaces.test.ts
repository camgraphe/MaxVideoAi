import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { parsePreflightRequestPayload } from '../frontend/app/api/preflight/_lib/preflight-request';
import { isWorkspaceModelCertifiedForBlock } from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/models/workspace-model-certification';
import { imageSelectionSchema, studioImageReferenceLimit } from '../frontend/lib/studio/conversation-creation-contract';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { GenerationCapabilityError, validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { getAgentModelDetails } from '../frontend/src/server/agent-api/model-details';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import { studioVisualCapabilityDetails } from '../frontend/src/server/studio/conversation-capabilities';
import { imageRequestFromDraft } from '../frontend/src/server/studio/conversation-image-request';
import { prepareImagePickerOption } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-model-picker';
import { parsePersistedImageComposerState } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-persistence';
import { IMAGE_COMPOSER_STORAGE_VERSION } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-types';

const modelIds = ['seedream-5-5', 'seedream-5-0-flash'] as const;
const tiers = ['1K', '1.5K', '2K'];

function candidate(modelId: string): AgentPublicGenerationEngine {
  const entry = listFalEngines().find(entry => entry.id === modelId);
  assert.ok(entry, `${modelId} must be registered`);
  return { engine: entry.engine, surface: 'image', publicModes: ['t2i', 'i2i'],
    modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])) };
}

function request(modelId: string): CanonicalGenerationRequest {
  return { schemaVersion: 1, surface: 'image', engineId: modelId, mode: 't2i',
    prompt: 'A product image with readable packaging text',
    settings: { resolution: '2K', aspectRatio: '1:1', outputFormat: 'png' }, references: [], outputCount: 1 };
}

test('Seedream 1K and 1.5K are admitted by the bounded app preflight vocabulary', () => {
  for (const modelId of modelIds) for (const resolution of tiers) {
    const parsed = parsePreflightRequestPayload({ engine: modelId, mode: 't2i', durationSec: 1, resolution, aspectRatio: '1:1' });
    assert.equal(parsed.ok, true, `${modelId} ${resolution}`);
  }
  assert.equal(parsePreflightRequestPayload({ engine: 'seedream-5-5', mode: 't2i', durationSec: 1, resolution: 'unbounded-new-tier' }).ok, false);
});

test('both latest Seedream versions are certified for Studio image creation and editing only', () => {
  for (const modelId of modelIds) {
    assert.equal(isWorkspaceModelCertifiedForBlock({ modelId, presetId: 'generate-image', workflowType: 'text_to_image' }), true, modelId);
    assert.equal(isWorkspaceModelCertifiedForBlock({ modelId, presetId: 'modify-image', workflowType: 'image_to_image' }), true, modelId);
    assert.equal(isWorkspaceModelCertifiedForBlock({ modelId, presetId: 'generate-video', workflowType: 'text_to_video' }), false, modelId);
    assert.equal(studioImageReferenceLimit(modelId), 10, modelId);
  }
});

test('MCP and Studio discover exact latest Seedream facts without inheriting a family review', async () => {
  const entries = listFalEngines();
  const deps = { listEngines: async () => entries.map(entry => entry.engine),
    surfaceByEngineId: (id: string) => entries.find(entry => entry.id === id)?.category === 'image' ? 'image' as const : 'video' as const,
    isEngineExecutable: () => true, isModeExecutable: () => true };
  for (const modelId of modelIds) {
    const mcp = await getAgentModelDetails(modelId, deps);
    assert.equal(mcp.generationEnabled, true);
    assert.equal(mcp.editorialGuidance.reviewStatus, 'unreviewed');
    assert.ok(mcp.promptingSources.length > 0, modelId);
    const studio = studioVisualCapabilityDetails(candidate(modelId));
    assert.equal(studio.surface, 'image');
    if (studio.surface === 'audio') throw new Error('Expected image details');
    assert.equal(studio.maxReferences, 10);
    for (const details of [mcp, studio]) {
      assert.deepEqual(details.modes.map(mode => mode.mode), ['t2i', 'i2i']);
      for (const mode of details.modes) {
        assert.deepEqual(mode.resolutions, tiers);
        assert.deepEqual(mode.outputCount, { min: 1, max: 1, default: 1 });
        assert.equal(mode.settings.find(setting => setting.key === 'resolution')?.default, null, 'Canonical base-control defaults remain owned by the caller.');
        if (mode.mode === 'i2i') assert.equal(mode.references.find(ref => ref.type === 'image')?.max, 10);
        const backgrounds = mode.settings.find(setting => setting.key === 'background');
        if (modelId === 'seedream-5-5') assert.deepEqual(backgrounds?.values?.slice().sort(), ['auto', 'opaque', 'transparent']);
        else assert.equal(backgrounds, undefined);
      }
    }
  }
});

test('canonical latest Seedream requests enforce one output, ten sources and supported output tiers', () => {
  for (const modelId of modelIds) {
    const capability = candidate(modelId);
    const base = request(modelId);
    for (const resolution of tiers) validateCanonicalGenerationCapabilities({ ...base, settings: { ...base.settings, resolution } }, capability);
    for (const resolution of ['3K', '4K']) assert.throws(() => validateCanonicalGenerationCapabilities({ ...base, settings: { ...base.settings, resolution } }, capability), GenerationCapabilityError);
    assert.throws(() => validateCanonicalGenerationCapabilities({ ...base, outputCount: 2 }, capability), GenerationCapabilityError);
    assert.throws(() => validateCanonicalGenerationCapabilities({ ...base, mode: 'i2i' }, capability), GenerationCapabilityError);
    const references = Array.from({ length: 10 }, (_, index) => ({ kind: 'asset' as const, assetId: `source-${index}`, role: 'reference' as const, slot: index }));
    validateCanonicalGenerationCapabilities({ ...base, mode: 'i2i', references }, capability);
    assert.throws(() => validateCanonicalGenerationCapabilities({ ...base, mode: 'i2i', references: [...references, { kind: 'asset', assetId: 'extra-source', role: 'reference', slot: 10 }] }, capability), GenerationCapabilityError);
  }
});

test('transparent Seedream 5.5 rejects JPEG before canonical preparation can price or charge', () => {
  const capability = candidate('seedream-5-5');
  const base = request('seedream-5-5');
  validateCanonicalGenerationCapabilities({ ...base, settings: { ...base.settings, background: 'transparent' } }, capability);
  validateCanonicalGenerationCapabilities({ ...base, settings: { ...base.settings, background: ' TRANSPARENT ', outputFormat: ' PNG ' } }, capability);
  assert.throws(() => validateCanonicalGenerationCapabilities({ ...base, settings: { ...base.settings, background: 'transparent', outputFormat: 'jpeg' } }, capability), GenerationCapabilityError);
  assert.throws(() => validateCanonicalGenerationCapabilities({ ...base, settings: { ...base.settings, background: ' TRANSPARENT ', outputFormat: ' JPEG ' } }, capability), GenerationCapabilityError);
  const flash = candidate('seedream-5-0-flash');
  assert.throws(() => validateCanonicalGenerationCapabilities({ ...request(flash.engine.id), settings: { ...base.settings, background: 'transparent' } }, flash), GenerationCapabilityError);
});

test('Studio image selection uses the declared resolution default when no exact pixel preset matches its ratio', () => {
  for (const modelId of modelIds) {
    const canonical = imageRequestFromDraft({ reply: 'Review the quote.', image: {
      modelId, prompt: 'A product on a neutral background', aspectRatio: '16:9', mode: 't2i', outputCount: 1,
    } }, { requestId: '123e4567-e89b-42d3-a456-426614174000', message: 'Create the image.', references: [] }, [candidate(modelId)]);
    assert.equal(canonical.settings.resolution, '2K');
  }
});

test('Studio preserves ten exact selected sources and Seedream output options through its saved-draft boundary', () => {
  const sourceIds = Array.from({ length: 10 }, (_, index) => `ma_${(9 - index).toString(16).padStart(32, 'a')}`);
  for (const modelId of modelIds) {
    const image = { modelId, mode: 'i2i', prompt: 'Keep these product identities, replace only the background.', aspectRatio: '16:9', outputCount: 1,
      settings: [{ name: 'resolution', value: '1.5K' }, { name: 'outputFormat', value: 'png' },
        ...(modelId === 'seedream-5-5' ? [{ name: 'background', value: 'transparent' }] : [])],
      references: sourceIds.map((assetId, index) => ({ ref: { type: 'asset', assetId, kind: 'image' }, role: 'reference', slot: index })) };
    const selection = imageSelectionSchema.parse(image);
    assert.equal(selection.references?.length, 10);
    assert.equal(imageSelectionSchema.safeParse({ ...image, references: [...image.references, { ...image.references[0], slot: 10 }] }).success, false);
    const canonical = imageRequestFromDraft({ reply: 'Review this exact image quote.', image: selection },
      { requestId: '123e4567-e89b-42d3-a456-426614174000', message: 'Make the edit.', references: sourceIds }, [candidate(modelId)]);
    assert.equal(canonical.engineId, modelId);
    assert.deepEqual(canonical.settings, { aspectRatio: '16:9', resolution: '1.5K', outputFormat: 'png', ...(modelId === 'seedream-5-5' ? { background: 'transparent' } : {}) });
    assert.deepEqual(canonical.references.map(ref => ref.kind === 'asset' ? ref.assetId : null), sourceIds);
    assert.deepEqual(normalizeGenerationRequest(canonical), canonical);
    validateCanonicalGenerationCapabilities(canonical, candidate(modelId));
  }
});

test('app model review clamps latest Seedream output count and preserves background in its composer snapshot', () => {
  for (const modelId of modelIds) {
    const { settings, disabledReason } = prepareImagePickerOption(candidate(modelId).engine, {
      mode: 'i2i', numImages: 4, resolution: '1.5K', aspectRatio: '16:9', quality: null,
      outputFormat: 'png', background: 'transparent', enableWebSearch: false,
      customImageWidth: '', customImageHeight: '', referenceImageCount: 10, selectedReferenceCount: 10,
      referenceIndices: Array.from({ length: 10 }, (_, index) => index), readyReferenceSizes: [],
    }, 'fr');
    assert.equal(disabledReason, undefined);
    assert.equal(settings.numImages, 1);
    assert.equal(settings.resolution, '1.5K');
    assert.equal(settings.background, modelId === 'seedream-5-5' ? 'transparent' : null);
    const snapshot = parsePersistedImageComposerState(JSON.stringify({ version: IMAGE_COMPOSER_STORAGE_VERSION, engineId: modelId, mode: 'i2i', ...settings }));
    assert.equal(snapshot?.engineId, modelId);
    assert.equal(snapshot?.resolution, '1.5K');
    assert.equal(snapshot?.background, settings.background);
  }
});
