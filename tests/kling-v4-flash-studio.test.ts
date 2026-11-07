import assert from 'node:assert/strict';
import test from 'node:test';
import { KLING_V4_FLASH_ENGINE as engine } from '../frontend/src/config/fal-engines/kling-v4-flash';
import { createStudioVideoGenerationService } from '../frontend/src/server/studio/image-generation-service';
import { studioMediaRequest, type StudioMediaFactories } from '../frontend/src/server/studio/conversation-media-generation';
import { studioVisualCapabilityDetails } from '../frontend/src/server/studio/conversation-capabilities';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { StudioMediaIntent } from '../frontend/lib/studio/conversation-media-contract';

const actor = { authMethod: 'studio-session' as const, userId: 'owner', projectId: 'film', clientId: null };
const candidate = { engine, surface: 'video' as const, publicModes: engine.modes, modeCaps: engine.modeCaps! };
const source = { type: 'asset' as const, kind: 'video' as const, assetId: 'ma_' + '1'.repeat(32) };
const reference = { type: 'asset' as const, kind: 'video' as const, assetId: 'ma_' + '2'.repeat(32) };
const input = { requestId: '00000000-0000-4000-8000-000000000001', message: 'Relight the original', references: [], attachments: [source, reference] };
const factories = { video: () => ({ catalog: async () => [candidate] }) } as unknown as StudioMediaFactories;
const action: Extract<StudioMediaIntent, { action: 'video.prepare' }> = { action: 'video.prepare', reply: 'Review this quote.', prompt: 'Relight @Video1 with the lighting from @Video2.', modelId: engine.id, mode: 'v2v', aspectRatio: '16:9', source: null,
  references: [{ ref: source, role: 'source', slot: null }, { ref: reference, role: 'reference', slot: null }],
};

test('the real Studio catalog retains Flash Modify with its required source and optional video references', async () => {
  const catalog = await createStudioVideoGenerationService(actor, { enabled: true, prepareDependencies: { listPublicEngines: async () => [candidate] } }).catalog();
  const flash = catalog.find(row => row.engine.id === engine.id)!;
  assert.ok(flash.publicModes.includes('v2v'));
  assert.ok(!flash.publicModes.includes('extend'));
  const details = studioVisualCapabilityDetails(flash).modes.find(mode => mode.mode === 'v2v')!;
  assert.ok(details.references.some(field => field.roles.includes('source') && field.type === 'video' && field.required));
  assert.ok(details.references.some(field => field.roles.includes('reference') && field.type === 'video' && field.max === 4));
});

test('Studio Flash Modify keeps omitted timing absent and preserves source versus extra reference roles', async () => {
  const dependencies = { resolveMedia: async (_owner: string, ref: unknown) => {
    const asset = ref as typeof source;
    return { id: asset.assetId, ref: asset, kind: 'video', url: `https://media.maxvideoai.com/user-assets/${asset.assetId}.mp4`, mime: 'video/mp4',
      width: 1280, height: 720, durationSec: asset.assetId === source.assetId ? 5.25 : 4, sizeBytes: 1024, originalName: 'original.mp4', originalAccess: { type: 'external' } } as never;
  } };
  for (const durationSec of [undefined, 3]) {
    const request = await studioMediaRequest(actor, { ...action, settings: [{ name: 'resolution', value: '720p' }, ...(durationSec === undefined ? [] : [{ name: 'durationSec', value: durationSec }])] }, input, factories, true, dependencies) as CanonicalGenerationRequest;
    assert.equal(request.settings.durationSec, durationSec);
    assert.equal(request.settings.aspectRatio, undefined);
    assert.deepEqual(request.references.map(ref => [ref.kind === 'asset' ? ref.assetId : null, ref.role, ref.slot]), [[source.assetId, 'source', undefined], [reference.assetId, 'reference', 0]]);
  }
});
