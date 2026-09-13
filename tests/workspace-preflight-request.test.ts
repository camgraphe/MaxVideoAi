import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkspacePreflightRequest, type WorkspacePreflightRequestOptions } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-preflight-request';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';

function options(): WorkspacePreflightRequestOptions {
  return {
    form: { engineId: 'seedance-2-0', mode: 't2v', durationSec: 5, resolution: '720p', aspectRatio: '16:9', fps: 24, iterations: 3, audio: false, extraInputValues: {}, seedLocked: true, loop: false },
    selectedEngine: { id: 'seedance-2-0', inputSchema: { required: [], optional: [
      { id: 'resolution', type: 'enum', label: 'Resolution', modes: ['t2v'] },
      { id: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', modes: ['t2v'] },
    ] } } as WorkspacePreflightRequestOptions['selectedEngine'],
    submissionMode: 't2v', effectiveDurationSec: 7, supportsAudioToggle: false, voiceControlEnabled: false, inputAssets: {}, memberTier: 'Member',
  };
}
test('request preserves supported fields and one-output semantics', () => {
  assert.deepEqual(buildWorkspacePreflightRequest(options()), {
    engine: 'seedance-2-0', mode: 't2v', durationSec: 7, resolution: '720p', aspectRatio: '16:9', fps: 24, seedLocked: true, loop: false, inputs: [], user: { memberTier: 'Member' },
  });
});
test('request omits unsupported schema fields and keeps optional audio/voice/extra values exact', () => {
  const input = options(); input.submissionMode = 'i2v'; input.supportsAudioToggle = true; input.voiceControlEnabled = true;
  input.form.extraInputValues = { count: 0, enabled: false, ids: ['x', 'y'] }; input.memberTier = 'Plus';
  const request = buildWorkspacePreflightRequest(input);
  assert.equal('resolution' in request, false); assert.equal('aspectRatio' in request, false);
  assert.equal(request.audio, false); assert.equal(request.voiceControl, true);
  assert.deepEqual(request.extraInputValues, input.form.extraInputValues); assert.deepEqual(request.user, { memberTier: 'Plus' });
});
test('request uses mode capabilities when no schema is present', () => {
  const input = options(); input.selectedEngine = { ...input.selectedEngine, inputSchema: undefined, modeCaps: { t2v: { resolution: ['720p'], aspectRatio: [] } } };
  const request = buildWorkspacePreflightRequest(input); assert.equal(request.resolution, '720p'); assert.equal('aspectRatio' in request, false);
});
test('request preserves original URLs, unresolved IDs and input order without promoting previews', () => {
  const input = options();
  const asset = { id: 'asset', fieldId: 'image_url', kind: 'image', status: 'ready', url: 'https://example.com/original.jpg', previewUrl: 'https://example.com/thumb.jpg', assetId: 'stored-id' } as ReferenceAsset;
  input.inputAssets = { image_url: [asset, null, { ...asset, assetId: undefined }, { ...asset, status: 'uploading' }, { ...asset, url: undefined }] };
  assert.deepEqual(buildWorkspacePreflightRequest(input).inputs, [
    { assetId: 'stored-id', slotId: 'image_url', kind: 'image', url: asset.url },
    { assetId: '', slotId: 'image_url', kind: 'image', url: asset.url },
  ]);
});

test('runtime Happy Horse edit schema omits user-selected framing fields', async () => {
  const { listFalEngines } = await import('../frontend/src/config/falEngines');
  const engine = listFalEngines().find((entry) => entry.id === 'happy-horse-1-1')?.engine;
  assert.ok(engine);
  const input = options(); input.selectedEngine = engine; input.form.engineId = engine.id; input.submissionMode = 'v2v';
  const request = buildWorkspacePreflightRequest(input);
  assert.equal('aspectRatio' in request, false);
});
