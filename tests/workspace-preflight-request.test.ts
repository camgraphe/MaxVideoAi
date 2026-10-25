import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkspacePreflightRequest, type WorkspacePreflightRequestOptions } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-preflight-request';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { parsePreflightRequestPayload } from '../frontend/app/api/preflight/_lib/preflight-request';
import { resolveWorkspaceWorkflow } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';

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
for (const id of ['kling-o3-standard', 'kling-o3-pro', 'kling-o3-4k']) test(`${id}: removing a Reference source does not throw before inferred Create mode synchronizes`, () => {
  const engine = getFalEngineById(id)!.engine;
  const form = { ...coerceFormState(engine, 'v2v', null), operation: 'kling-reference' as const };
  for (const [fieldId, mode] of [[null, 't2v'], ['image_urls', 'ref2v'], ['image_url', 'i2v']] as const) {
    const inputAssets = fieldId ? { [fieldId]: [{ id: 'image', fieldId, assetId: 'image', kind: 'image', status: 'ready',
      url: 'https://example.com/original.png' } as ReferenceAsset] } : {};
    const workflow = resolveWorkspaceWorkflow({ engine, form, inputAssets, klingElements: [] });
    assert.equal(workflow.submissionMode, mode);
    const before = structuredClone(form);
    const request = buildWorkspacePreflightRequest({ ...options(), form, selectedEngine: engine, inputAssets, submissionMode: workflow.submissionMode });
    assert.equal(request.mode, mode);
    assert.deepEqual(form, before);
  }
});
test('workspace sends Auto duration to preflight instead of quoting a stale numeric hint', () => {
  const input = options();
  input.form.durationOption = 'auto';
  const request = buildWorkspacePreflightRequest(input);
  assert.equal(request.durationOption, 'auto');
  assert.equal(parsePreflightRequestPayload(request).ok, true);
});

for (const [engineId, mode, selectedDuration, seconds] of [
  ['luma-ray-3-2', 'v2v', '5s', 5],
  ['luma-ray-3-2', 'reframe', '10s', 10],
  ['luma-ray-3-2', 't2v', '5s', 5],
  ['luma-ray-3-2', 'i2v', '10s', 10],
  ['gemini-omni-flash', 'v2v', '3s', 3],
  ['gemini-omni-flash', 'v2v', '10s', 10],
  ['kling-o3-standard', 'v2v', '5', 5],
  ['seedance-2-5', 'v2v', '15', 15],
] as const) {
  test(`${engineId} ${mode} duration selection ${selectedDuration} reaches the strict preflight boundary`, () => {
    const input = options();
    input.selectedEngine = getFalEngineById(engineId)!.engine;
    input.submissionMode = mode;
    input.form = coerceFormState(input.selectedEngine, mode, null);
    // The duration control preserves the selected enum string in form state.
    input.form.durationOption = selectedDuration;
    input.form.durationSec = seconds;
    input.effectiveDurationSec = seconds;
    const request = JSON.parse(JSON.stringify(buildWorkspacePreflightRequest(input)));
    const parsed = parsePreflightRequestPayload(request);
    assert.equal(parsed.ok, true, JSON.stringify(parsed));
    assert.equal(request.durationOption, seconds);
    assert.equal(request.durationSec, seconds);
    assert.equal(input.form.durationOption, selectedDuration, 'Quoting must not mutate the editor.');
  });
}

test('preflight duration normalization does not reinterpret malformed or non-second units', () => {
  for (const value of ['5seconds', '5ms', '5s junk', '-5s', '0s', 'NaN', 'Infinity']) {
    const input = options();
    input.form.durationOption = value;
    const request = JSON.parse(JSON.stringify(buildWorkspacePreflightRequest(input)));
    assert.equal(parsePreflightRequestPayload(request).ok, false, value);
  }
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

test('Max opening-image preflight does not send a unified composer slot as a pricing dependency', () => {
  const input = options();
  input.selectedEngine = getFalEngineById('flux-3-max')!.engine;
  input.submissionMode = 'i2v';
  input.form = coerceFormState(input.selectedEngine, 'i2v', null);
  input.effectiveDurationSec = 5;
  input.inputAssets = { start_image_url: [{ id: 'opening', assetId: 'owned-opening', kind: 'image',
    fieldId: 'start_image_url', status: 'ready', url: 'https://media.example/opening.png' } as ReferenceAsset] };
  const before = structuredClone(input.inputAssets);
  const request = buildWorkspacePreflightRequest(input);
  assert.equal(parsePreflightRequestPayload(JSON.parse(JSON.stringify(request))).ok, true);
  assert.deepEqual(request.inputs, []);
  assert.deepEqual(input.inputAssets, before);
});

test('reference-priced Grok keeps every reference and rejects unresolved media before quoting', () => {
  const input = options();
  input.selectedEngine = getFalEngineById('grok-imagine-video-1-5')!.engine;
  input.submissionMode = 'ref2v';
  input.form = coerceFormState(input.selectedEngine, 'ref2v', null);
  input.effectiveDurationSec = input.form.durationSec;
  assert.ok(input.selectedEngine.pricingDetails?.referenceImages?.modes.includes('ref2v'));
  input.inputAssets = { reference_image_urls: [0, 1].map(index => ({ id: `ref-${index}`, assetId: `owned-${index}`,
    kind: 'image', fieldId: 'reference_image_urls', status: 'ready', url: `https://media.example/ref-${index}.png` } as ReferenceAsset)) };
  const request = buildWorkspacePreflightRequest(input);
  assert.deepEqual(request.inputs?.map(reference => reference.assetId), ['owned-0', 'owned-1']);
  assert.equal(parsePreflightRequestPayload(JSON.parse(JSON.stringify(request))).ok, true);
  input.inputAssets.reference_image_urls[1]!.assetId = undefined;
  const unresolved = buildWorkspacePreflightRequest(input);
  assert.equal(unresolved.inputs?.length, 2, 'An unresolved priced reference must never silently disappear.');
  assert.equal(parsePreflightRequestPayload(JSON.parse(JSON.stringify(unresolved))).ok, false);
});

test('runtime Happy Horse edit schema omits user-selected framing fields', async () => {
  const { listFalEngines } = await import('../frontend/src/config/falEngines');
  const engine = listFalEngines().find((entry) => entry.id === 'happy-horse-1-1')?.engine;
  assert.ok(engine);
  const input = options(); input.selectedEngine = engine; input.form.engineId = engine.id; input.submissionMode = 'v2v';
  const request = buildWorkspacePreflightRequest(input);
  assert.equal('aspectRatio' in request, false);
});
