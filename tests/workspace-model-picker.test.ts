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
  assert.deepEqual(groups.map(group => group.ids), [['seedance-2-5', 'kling-v4', 'wan-3-prime'], ['wan-3', 'flux-3-max'], ['seedance-2-0-mini', 'minimax-h3']]);
  assert.deepEqual(getPickerRecommendations([engine('wan-3')], 't2v').flatMap(group => group.ids), ['wan-3']);
  assert.deepEqual(getPickerRecommendations(engines, 't2i'), []);
  assert.ok(!getPickerRecommendations([{ ...engine('wan-3'), availability: 'paused' }], 't2v').length);
});
test('Kling 4 promotion preserves mode admission and the contextual Modify shortlist', () => {
  const kling = engine('kling-v4');
  const quality = (catalogue: typeof engines, mode: 't2v' | 'i2v' | 'fl2v' | 'v2v') =>
    getPickerRecommendations(catalogue, mode).find(group => group.group === 'quality')?.ids ?? [];
  assert.deepEqual(quality(engines, 'i2v'), ['seedance-2-5', 'kling-v4', 'wan-3-prime']);
  assert.deepEqual(quality(engines.filter(item => item.id !== kling.id), 't2v'), ['seedance-2-5', 'wan-3-prime']);
  for (const excluded of [
    { ...kling, availability: 'paused' as const },
    { ...kling, modes: kling.modes.filter(value => value !== 't2v') },
    { ...kling, modeAvailability: { t2v: { available: false } } },
  ]) assert.deepEqual(quality(engines.map(item => item.id === kling.id ? excluded : item), 't2v'), ['seedance-2-5', 'wan-3-prime']);
  assert.ok(!quality(engines, 'fl2v').includes(kling.id), 'promotion cannot invent a first/last contract');
  assert.deepEqual(quality(engines, 'v2v'), ['luma-ray-3-2', 'kling-o3-pro', 'wan-3-prime']);
});
test('Create budgets lead with Mini only when that model and mode are admitted', () => {
  const mini = engine('seedance-2-0-mini');
  const budget = (catalogue: typeof engines, mode: 't2v' | 'i2v' | 'v2v') =>
    getPickerRecommendations(catalogue, mode).find(group => group.group === 'budget')?.ids ?? [];
  for (const mode of ['t2v', 'i2v'] as const) {
    assert.deepEqual(budget(engines, mode), ['seedance-2-0-mini', 'minimax-h3']);
    assert.deepEqual(budget(engines.filter(item => item.id !== mini.id), mode), ['minimax-h3']);
    for (const excluded of [
      { ...mini, availability: 'paused' as const },
      { ...mini, modes: mini.modes.filter(value => value !== mode) },
      { ...mini, modeAvailability: { [mode]: { available: false } } },
    ]) assert.deepEqual(budget(engines.map(item => item.id === mini.id ? excluded : item), mode), ['minimax-h3']);
  }
  assert.deepEqual(budget(engines, 'v2v'), [], 'Create budget promotion does not add a Modify recommendation');
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
test('Mini estimates retain text/image mode and pass the changed scenario to canonical pricing', () => {
  for (const mode of ['t2v', 'i2v'] as const) {
    const current = setup('seedance-2-0-mini');
    current.form.mode = mode;
    if (mode === 'i2v') current.inputAssets.image_url = [{
      id: 'start', assetId: 'start', fieldId: 'image_url', kind: 'image', name: 'start', type: 'image/png',
      size: 1024, status: 'ready', url: 'https://example.com/start.png', previewUrl: 'https://example.com/start.png',
      width: 1280, height: 720,
    }];
    const before = structuredClone(current);
    for (const durationSec of [5, 10]) {
      const option = buildWorkspacePickerOptions({ current, engines, locale: 'fr', memberTier: 'Member',
        overrides: { durationSec, resolution: '720p', aspectRatio: '16:9', audio: false },
      })['seedance-2-0-mini'];
      assert.equal(option.disabledReason, undefined);
      assert.equal(option.request?.engine, 'seedance-2-0-mini');
      assert.equal(option.request?.mode, mode);
      assert.equal(option.request?.durationSec, durationSec);
      assert.equal(option.request?.resolution, '720p');
      assert.equal(option.request?.audio, false);
      if (mode === 'i2v') assert.deepEqual(option.request?.inputs?.map(input => input.assetId), ['start']);
    }
    assert.deepEqual(current, before);
  }
});
test('Kling and mandatory-audio H3 disclose the effective quote settings', () => {
  const rows = buildWorkspacePickerOptions({ current: setup(), engines, locale: 'fr', memberTier: 'Member' });
  assert.equal(rows['kling-o3-pro'].request?.resolution, '1080p');
  assert.ok(rows['kling-o3-pro'].changes.some(change => change.after === '1080p'));
  assert.match(rows['minimax-h3'].summary, /Son: Toujours activé/);
  assert.ok(rows['minimax-h3'].changes.some(change => change.label === 'Son' && change.after === 'Toujours activé'));
});
test('an explicit other-model choice from Modify prepares Create without reusing its source', () => {
  const current = setup('luma-ray-3-2');
  current.form.mode = 'v2v';
  current.inputAssets.video_url = [{ id: 'source', assetId: 'source', fieldId: 'video_url', kind: 'video', name: 'source', type: 'video/mp4', size: 1, status: 'ready', url: 'https://example.com/source.mp4', previewUrl: 'https://example.com/source.mp4', durationSec: 8 }];
  const before = structuredClone(current);
  const rows = buildWorkspacePickerOptions({ current, engines, locale: 'fr', memberTier: 'Member' });
  assert.equal(rows['flux-3-max'].disabledReason, undefined);
  assert.equal(rows['flux-3-max'].request?.mode, 't2v');
  assert.ok(!rows['flux-3-max'].request?.inputs?.some(input => input.assetId === 'source'));
  assert.equal(rows['luma-ray-3-2'].request?.mode, 'v2v', 'current model retains Modify');
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

for (const resolution of ['480P', '2K']) test(`the picker retains ${resolution} Relight, its lighting image and framing`, () => {
  const current = setup('minimax-h3-max');
  current.form = { ...coerceFormState(engine('minimax-h3-max'), 'v2v', null), operation: 'h3-relight', resolution, aspectRatio: '9:16' };
  const reference = (fieldId: string, kind: 'video' | 'image') => ({
    id: fieldId, assetId: fieldId, fieldId, kind, status: 'ready' as const, name: fieldId,
    type: kind === 'video' ? 'video/mp4' : 'image/png', size: 1024, width: 720, height: 1280,
    durationSec: kind === 'video' ? 107 / 24 : null,
    url: `https://example.com/${fieldId}`, previewUrl: `https://example.com/${fieldId}`,
  });
  current.inputAssets = { video_url: [reference('video_url', 'video')], reference_image_url: [reference('reference_image_url', 'image')] };
  const before = structuredClone(current);
  const option = buildWorkspacePickerOptions({ current, engines, locale: 'fr', memberTier: 'Member' })['minimax-h3-max'];
  assert.equal(option.disabledReason, undefined);
  assert.ok(option.request, 'the complete Relight setup can be estimated');
  assert.equal(option.request.operation, 'h3-relight');
  assert.deepEqual(option.request.inputs?.map(input => input.assetId).sort(), ['reference_image_url', 'video_url']);
  assert.equal(option.request.resolution, resolution);
  assert.equal(option.request.aspectRatio, '9:16');
  assert.deepEqual(current, before);
});

for (const id of ['kling-o3-standard', 'kling-o3-pro', 'kling-o3-4k']) test(`${id}: the Edit picker quote keeps source timing and omits generated framing`, () => {
  const current = setup(id);
  current.form = { ...coerceFormState(engine(id), 'v2v', null), operation: 'kling-edit', aspectRatio: '16:9', extraInputValues: { keep_audio: false } };
  current.inputAssets = { video_url: [{ id: 'source', assetId: 'source', fieldId: 'video_url', kind: 'video', name: 'source', type: 'video/mp4', size: 1, status: 'ready',
    url: 'https://example.com/source.mp4', previewUrl: 'https://example.com/source.mp4', durationSec: 5.25, width: 720, height: 1280 }] };
  const before = structuredClone(current);
  const option = buildWorkspacePickerOptions({ current, engines, locale: 'en', memberTier: 'Member' })[id];
  assert.equal(option.disabledReason, undefined);
  assert.ok(option.request);
  assert.equal(option.request.operation, 'kling-edit');
  assert.equal(option.request.durationSec, 5.25);
  assert.equal(option.request.aspectRatio, undefined);
  assert.deepEqual(option.request.inputs?.map(input => input.assetId), ['source']);
  assert.deepEqual(current, before);
});
