import assert from 'node:assert/strict';
import test from 'node:test';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { preparePickerScenario, pickerScenarioControls, updatePickerScenario } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-picker-scenario';
import { buildWorkspacePickerOptions } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-picker';
import type { WorkspaceModelSetup } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-candidate';
const engines = getBaseEnginesByCategory('video');
const engine = (id: string) => engines.find(entry => entry.id === id)!;
function setup(id = 'wan-3-prime', mode: 't2v' | 'v2v' = 't2v'): WorkspaceModelSetup {
  return { form: { ...coerceFormState(engine(id), mode, null), durationSec: 5, durationOption: 5, resolution: '720p', audio: false }, prompt: 'A scene', negativePrompt: '', inputAssets: {}, klingElements: [], multiPromptEnabled: false, multiPromptScenes: [], shotType: 'customize', voiceIdsInput: '', cfgScale: null };
}
test('same-model price scenario is isolated, disclosed and matches the quote', () => {
  const current = setup(), before = structuredClone(current);
  const overrides = { durationSec: 10, resolution: '1080p', iterations: 2, audio: true };
  const candidate = preparePickerScenario({ current, engine: engine('wan-3-prime'), currentEngine: engine('wan-3-prime'), locale: 'en', overrides });
  assert.equal(candidate.setup.form.durationSec, 10);
  assert.equal(candidate.setup.form.resolution, '1080p');
  assert.equal(candidate.setup.form.audio, true);
  assert.ok(candidate.changes.some(change => change.field === 'durationSec' && change.before === 5 && change.after === 10));
  const row = buildWorkspacePickerOptions({ current, engines, locale: 'en', memberTier: 'Member', overrides })['wan-3-prime'];
  assert.equal(row.request?.durationSec, 10);
  assert.equal(row.request?.resolution, '1080p');
  assert.equal(row.iterations, 2);
  assert.deepEqual(current, before);
});
for (const [locale, fixedAudio, optionalAudio] of [
  ['en', 'Audio: Always on', 'Audio off'],
  ['fr', 'Son: Toujours activé', 'Sans audio'],
  ['es', 'Audio: Siempre activado', 'Sin audio'],
]) test(`${locale}: an explicit audio choice stays editable while native audio is disclosed as fixed`, () => {
  const current = setup();
  const before = structuredClone(current);
  const candidate = preparePickerScenario({ current, engine: engine('wan-3'), currentEngine: engine('wan-3-prime'), locale, overrides: { audio: false } });
  assert.equal(candidate.setup.form.audio, false);
  const rows = buildWorkspacePickerOptions({ current, engines, locale, memberTier: 'Member', overrides: { audio: false } });
  assert.ok(rows['wan-3'].summary.endsWith(optionalAudio));
  assert.equal(rows['wan-3'].request?.audio, false);
  for (const id of ['minimax-h3', 'minimax-h3-max', 'happy-horse-1-0']) {
    assert.ok(rows[id].summary.endsWith(fixedAudio), rows[id].summary);
    assert.ok(rows[id].request);
    assert.equal('audio' in rows[id].request!, false);
  }
  assert.deepEqual(current, before);
});
for (const operation of ['h3-recast', 'h3-relight'] as const) {
  for (const [locale, retainedAudio] of [
    ['en', 'Source audio retained'],
    ['fr', 'Audio source conservé'],
    ['es', 'Audio original conservado'],
  ]) test(`${locale}: ${operation} discloses retained source audio for a complete silent-source setup`, () => {
    const current = setup('minimax-h3-max', 'v2v');
    current.prompt = '';
    current.form = { ...current.form, operation, resolution: '768P', aspectRatio: 'auto' };
    const imageField = operation === 'h3-recast' ? 'reference_image_urls' : 'reference_image_url';
    const source = { id: 'silent-source', assetId: 'silent-source', fieldId: 'video_url', kind: 'video' as const,
      status: 'ready' as const, name: 'silent-source.mp4', type: 'video/mp4', size: 1024, width: 1920, height: 1080,
      durationSec: 124 / 24, fps: 24, decodedFrameCount: 124, constantFrameRate: true, hasAudio: false,
      url: 'https://example.com/silent.mp4', previewUrl: 'https://example.com/silent.mp4' };
    current.inputAssets = { video_url: [source], [imageField]: [{ id: imageField, assetId: imageField, fieldId: imageField,
      kind: 'image', status: 'ready', name: 'reference.png', type: 'image/png', size: 1024, width: 512, height: 512,
      url: 'https://example.com/reference.png', previewUrl: 'https://example.com/reference.png' }] };
    const before = structuredClone(current);
    const row = buildWorkspacePickerOptions({ current, engines, locale, memberTier: 'Member' })['minimax-h3-max'];
    assert.ok(row.request, 'the complete silent-source operation remains estimable');
    assert.ok(row.summary.endsWith(retainedAudio), row.summary);
    assert.equal(row.request.operation, operation);
    assert.equal(row.request.durationSec, 124 / 24);
    assert.equal('audio' in row.request, false);
    assert.deepEqual(row.request.inputs?.map(input => input.assetId), ['silent-source', imageField]);
    assert.deepEqual(current, before);
  });
}
test('source timing is read-only and a forged duration cannot replace measured media timing', () => {
  const current = setup('kling-o3-pro', 'v2v');
  current.form.operation = 'kling-edit';
  const controls = pickerScenarioControls(current, engine('kling-o3-pro'), {}, 'en');
  assert.match(controls.find(control => control.id === 'durationSec')?.value ?? '', /source/i);
  assert.equal(controls.find(control => control.id === 'durationSec')?.options, undefined);
  current.inputAssets.video_url = [{ id: 'source', assetId: 'source', fieldId: 'video_url', kind: 'video', status: 'ready', name: 'source', type: 'video/mp4', size: 1, durationSec: 5.25, url: 'https://example.com/source.mp4', previewUrl: 'https://example.com/source.mp4' }];
  const row = buildWorkspacePickerOptions({ current, engines, locale: 'en', memberTier: 'Member', overrides: { durationSec: 10 } })['kling-o3-pro'];
  assert.equal(row.request?.durationSec, 5.25);
  assert.equal(row.request?.operation, 'kling-edit');
  assert.deepEqual(row.request?.inputs?.map(input => input.assetId), ['source']);
});
test('a different model uses Create even when price options were edited in Modify', () => {
  const current = setup('minimax-h3-max', 'v2v');
  current.form.operation = 'h3-relight';
  const rows = buildWorkspacePickerOptions({ current, engines, locale: 'en', memberTier: 'Member', overrides: { resolution: '1080p' } });
  assert.equal(rows['wan-3'].disabledReason, undefined);
  assert.equal(rows['wan-3'].request?.mode, 't2v');
  assert.equal(rows['wan-3'].request?.operation, undefined);
});

test('automatic durations can be compared at an explicit duration and restored to Auto', () => {
  const current = setup('seedance-2-0');
  current.form.durationOption = 'auto';
  const controls = pickerScenarioControls(current, engine(current.form.engineId), {}, 'en');
  const duration = controls.find(control => control.id === 'durationSec')!;
  assert.equal(duration.value, 'auto');
  assert.ok(duration.options?.some(option => option.value === '10'));
  assert.ok(duration.options?.some(option => option.value === 'auto'));
  const ten = updatePickerScenario(current, engine(current.form.engineId), {}, 'durationSec', '10');
  assert.equal(ten.durationSec, 10);
  const candidate = preparePickerScenario({ current, engine: engine(current.form.engineId), currentEngine: engine(current.form.engineId), locale: 'en', overrides: ten });
  assert.equal(candidate.setup.form.durationSec, 10);
  const auto = updatePickerScenario(current, engine(current.form.engineId), ten, 'durationSec', 'auto');
  const restored = preparePickerScenario({ current, engine: engine(current.form.engineId), currentEngine: engine(current.form.engineId), locale: 'en', overrides: auto });
  assert.equal(restored.setup.form.durationOption, 'auto');
});

test('source audio retention is editable and matches the Modify quote input', () => {
  const current = setup('kling-o3-pro', 'v2v');
  current.form.operation = 'kling-edit';
  current.form.extraInputValues.keep_audio = false;
  const controls = pickerScenarioControls(current, engine(current.form.engineId), {}, 'en');
  assert.equal(controls.find(control => control.id === 'keepAudio')?.value, 'false');
  assert.equal(controls.find(control => control.id === 'audio'), undefined);
  const overrides = updatePickerScenario(current, engine(current.form.engineId), {}, 'keepAudio', 'true');
  const candidate = preparePickerScenario({ current, engine: engine(current.form.engineId), currentEngine: engine(current.form.engineId), locale: 'en', overrides });
  assert.equal(candidate.setup.form.extraInputValues.keep_audio, true);
  const row = buildWorkspacePickerOptions({ current, engines, locale: 'en', memberTier: 'Member' })[current.form.engineId];
  assert.match(row.summary, /Mute source audio/);
  const markedEngines = engines.map(entry => entry.id !== current.form.engineId ? entry : {
    ...entry, operationCaps: { ...entry.operationCaps, 'kling-edit': { ...entry.operationCaps!['kling-edit']!,
      ui: { ...entry.operationCaps!['kling-edit']!.ui, audioPresentation: 'source' as const } } },
  });
  const markedRow = buildWorkspacePickerOptions({ current, engines: markedEngines, locale: 'en', memberTier: 'Member' })[current.form.engineId];
  assert.equal(markedRow.summary, row.summary, 'the explicit source-audio control remains authoritative');
  assert.deepEqual(markedRow.request, row.request, 'display provenance cannot change the request');
});
