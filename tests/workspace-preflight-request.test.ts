import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkspacePreflightRequest, type WorkspacePreflightRequestOptions } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-preflight-request';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { parsePreflightRequestPayload } from '../frontend/app/api/preflight/_lib/preflight-request';

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
test('workspace sends Auto duration to preflight instead of quoting a stale numeric hint', () => {
  const input = options();
  input.form.durationOption = 'auto';
  const request = buildWorkspacePreflightRequest(input);
  assert.equal(request.durationOption, 'auto');
  assert.equal(parsePreflightRequestPayload(request).ok, true);
});
for (const mode of ['t2v', 'ref2v'] as const) {
  for (const durationSec of [8, 16]) {
    test(`Max ${mode} ${durationSec}s workspace duration passes the API preflight schema`, () => {
      const input = options();
      input.selectedEngine = getFalEngineById('flux-3-max')!.engine;
      input.submissionMode = mode;
      input.form = coerceFormState(input.selectedEngine, mode, { ...input.form, durationSec, durationOption: durationSec });
      input.effectiveDurationSec = durationSec;
      input.supportsAudioToggle = true;
      if (mode === 'ref2v') {
        input.form.extraInputValues = { reasoning_level: 'high', keyframe_indexes: `0,${durationSec * 12},${durationSec * 24}` };
        input.inputAssets = { reference_image_urls: [0, 1, 2].map(index => ({
          id: `frame-${index}`, assetId: `stored-frame-${index}`, fieldId: 'reference_image_urls', kind: 'image',
          status: 'ready', url: `https://media.example/frame-${index}.png`, previewUrl: `https://media.example/frame-${index}.png`,
        } as ReferenceAsset)) };
      }
      const request = JSON.parse(JSON.stringify(buildWorkspacePreflightRequest(input)));
      const parsed = parsePreflightRequestPayload(request);
      assert.equal(parsed.ok, true, JSON.stringify(parsed));
      assert.equal(request.durationOption, durationSec);
      assert.equal(request.durationSec, durationSec);
    });
  }
}
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
