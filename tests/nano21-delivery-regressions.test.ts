import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { imageSelectionSchema } from '../frontend/lib/studio/conversation-creation-contract';
import { studioActionRequestSchema } from '../frontend/lib/studio/conversation-action-contract';
import { studioVisualCapabilityDetails } from '../frontend/src/server/studio/conversation-capabilities';
import { studioGenerationReferenceLimit } from '../frontend/src/server/studio/conversation-reference-limits';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { requireStudioGenerationRequest } from '../frontend/src/server/agent-api/generation-actor';
import { buildDefaultSettingsSnapshot } from '../frontend/src/server/images/image-generation-settings-snapshot';
import { normalizeNano21Settings } from '../frontend/src/lib/nano-banana-2-1';

const modelId = 'nano-banana-2-1';
const entry = getFalEngineById(modelId)!;
const references = Array.from({ length: 15 }, (_, index) => ({
  ref: { type: 'asset' as const, kind: 'image' as const, assetId: `asset-${index}` }, role: 'reference' as const, slot: null,
}));
const selection = (count: number, id = modelId) => ({ modelId: id, prompt: 'Preserve each visual reference.',
  aspectRatio: '16:9', mode: 'i2i' as const, references: references.slice(0, count) });

test('Studio discovers and validates the fourteen native Nano21 image references together', () => {
  const details = studioVisualCapabilityDetails({ engine: entry.engine, surface: 'image',
    publicModes: entry.modes.map(mode => mode.mode) as never,
    modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])) });
  assert.equal(details.maxReferences, 14);
  if (details.surface === 'audio') throw new Error('Expected image details.');
  assert.equal(details.modes.find(mode => mode.mode === 'i2i')?.references[0]?.max, 14);
  assert.equal(studioGenerationReferenceLimit(modelId, 'image', 'i2i'), 14);
  for (const count of [8, 9, 14]) {
    assert.equal(imageSelectionSchema.safeParse(selection(count)).success, true, `selection ${count}`);
    assert.equal(studioActionRequestSchema.safeParse({ action: 'image.prepare', reply: 'Review the exact quote.', ...selection(count) }).success, true, `action ${count}`);
    assert.doesNotThrow(() => requireStudioGenerationRequest(normalizeGenerationRequest({
      surface: 'image', engineId: modelId, mode: 'i2i', prompt: 'Preserve each visual reference.', settings: {}, outputCount: 1,
      references: references.slice(0, count).map(({ref}) => ({ kind: 'asset' as const, assetId: ref.assetId, role: 'reference' as const })),
    })));
  }
  assert.equal(imageSelectionSchema.safeParse(selection(15)).success, false);
  assert.equal(studioActionRequestSchema.safeParse({ action: 'image.prepare', reply: 'Review.', ...selection(15) }).success, false);
  assert.equal(imageSelectionSchema.safeParse(selection(9, 'gpt-image-2')).success, false, 'existing image model policy stays bounded at eight');
  assert.equal(studioActionRequestSchema.safeParse({ action: 'image.prepare', reply: 'Review.', ...selection(9, 'gpt-image-2') }).success, false);
});

test('Nano job snapshots preserve the App thinking vocabulary without changing native provider settings', () => {
  for (const thinkingLevel of ['minimal', 'medium', 'high']) {
    const native = normalizeNano21Settings({ resolution: '1k', thinkingLevel });
    const snapshot = buildDefaultSettingsSnapshot({ surface: 'image', nano21Settings: native,
      engineEntry: entry, mode: 't2i', prompt: 'An original still.', numImages: 1, resolvedAspectRatio: '16:9', resolution: '1k',
      customImageSize: null, normalizedSeed: null, outputFormat: null, quality: null, background: null, style: null,
      maskUrl: null, enableWebSearch: false, thinkingLevel, limitGenerations: false, watermark: false,
      imageUrls: [], characterReferences: [], visibility: 'private', indexable: false,
    }) as { core: { thinkingLevel: string; maxOutputTokens: number } };
    assert.equal(snapshot.core.thinkingLevel, thinkingLevel, 'reuse must restore the selected thinking level');
    assert.equal(native.thinkingLevel, thinkingLevel.toUpperCase(), 'the Vertex request vocabulary stays native');
    assert.equal(snapshot.core.maxOutputTokens, native.maxOutputTokens);
  }
});
