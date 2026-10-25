import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { buildWorkspacePickerOptions } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-picker';
import { getPickerRecommendations } from '../frontend/lib/model-picker-policy';
import type { WorkspaceModelSetup } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-candidate';

const engines = listFalEngines().map(entry => entry.engine);
const engine = (id: string) => engines.find(item => item.id === id)!;
function setup(id = 'wan-3-prime'): WorkspaceModelSetup {
  const form = coerceFormState(engine(id), 't2v', null);
  return { form: { ...form, durationSec: 5, durationOption: 5, resolution: '720p', audio: false, iterations: 1 },
    inputAssets: {}, klingElements: [], prompt: '', negativePrompt: '', multiPromptEnabled: false,
    multiPromptScenes: [], shotType: 'customize', voiceIdsInput: '', cfgScale: null };
}
test('approved recommendations preserve order and never invent absent models', () => {
  const groups = getPickerRecommendations(engines, 't2v');
  assert.deepEqual(groups.map(group => group.ids), [['seedance-2-5', 'wan-3-prime', 'kling-o3-pro'], ['wan-3', 'flux-3-max'], ['minimax-h3']]);
  assert.deepEqual(getPickerRecommendations([engine('wan-3')], 't2v').flatMap(group => group.ids), ['wan-3']);
  assert.deepEqual(getPickerRecommendations(engines, 't2i'), []);
  assert.ok(!getPickerRecommendations([{ ...engine('wan-3'), availability: 'paused' }], 't2v').length);
});
test('blank prompt can be estimated without mutating the draft or inventing a generation prompt', () => {
  const current = setup();
  const before = structuredClone(current);
  const rows = buildWorkspacePickerOptions({ current, engines, locale: 'fr', memberTier: 'Member' });
  assert.ok(rows['wan-3'].request);
  assert.equal(rows['wan-3'].request?.engine, 'wan-3');
  assert.equal(rows['wan-3'].request?.durationSec, 5);
  assert.deepEqual(current, before);
  assert.ok(!('prompt' in rows['wan-3'].request!));
});
test('Kling and mandatory-audio H3 disclose the effective quote settings', () => {
  const rows = buildWorkspacePickerOptions({ current: setup(), engines, locale: 'fr', memberTier: 'Member' });
  assert.equal(rows['kling-o3-pro'].request?.resolution, '1080p');
  assert.ok(rows['kling-o3-pro'].changes.some(change => change.after === '1080p'));
  assert.match(rows['minimax-h3'].summary, /audio/i);
  assert.ok(rows['minimax-h3'].changes.some(change => change.label === 'Son' && change.after === 'Toujours activé'));
});
test('a source cannot be discarded or Modify silently turned into Text to Video', () => {
  const current = setup('luma-ray-3-2');
  current.form.mode = 'v2v';
  current.inputAssets.video_url = [{ id: 'source', assetId: 'source', fieldId: 'video_url', kind: 'video', name: 'source', type: 'video/mp4', size: 1, status: 'ready', url: 'https://example.com/source.mp4', previewUrl: 'https://example.com/source.mp4', durationSec: 8 }];
  const before = structuredClone(current);
  const rows = buildWorkspacePickerOptions({ current, engines, locale: 'fr', memberTier: 'Member' });
  assert.ok(rows['flux-3-max'].disabledReason);
  assert.equal(rows['flux-3-max'].request, null);
  assert.deepEqual(current, before);
});
test('missing Modify source produces a truthful prerequisite instead of quoting another mode', () => {
  const current = setup('luma-ray-3-2');
  current.form.mode = 'v2v';
  const rows = buildWorkspacePickerOptions({ current, engines, locale: 'fr', memberTier: 'Member' });
  assert.equal(rows['luma-ray-3-2'].request, null);
  assert.match(rows['luma-ray-3-2'].priceUnavailableReason ?? '', /source/i);
});

test('runtime-unavailable modes are neither promoted nor estimated', () => {
  const unavailable = { ...engine('seedance-2-5'), modeAvailability: { t2v: { available: false } } };
  const catalogue = engines.map(item => item.id === unavailable.id ? unavailable : item);
  assert.ok(!getPickerRecommendations(catalogue, 't2v').flatMap(group => group.ids).includes(unavailable.id));
  const option = buildWorkspacePickerOptions({ current: setup(), engines: catalogue, locale: 'fr', memberTier: 'Member' })[unavailable.id];
  assert.ok(option.disabledReason);
  assert.equal(option.request, null);
});
