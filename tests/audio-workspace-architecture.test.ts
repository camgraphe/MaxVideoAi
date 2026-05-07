import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const audioDir = join(root, 'frontend/app/(core)/(workspace)/app/audio');
const workspacePath = join(audioDir, 'AudioWorkspace.tsx');
const controlsPath = join(audioDir, '_components/audio-workspace-controls.tsx');
const generatedPickerPath = join(audioDir, '_components/audio-generated-video-picker.tsx');
const helpersPath = join(audioDir, '_lib/audio-workspace-helpers.ts');
const typesPath = join(audioDir, '_lib/audio-workspace-types.ts');

const workspaceSource = readFileSync(workspacePath, 'utf8');

test('audio workspace delegates local controls, helpers, and contracts', () => {
  assert.ok(existsSync(controlsPath), 'audio control components should live in a route-local component module');
  assert.ok(existsSync(generatedPickerPath), 'generated video picker should live in a route-local component module');
  assert.ok(existsSync(helpersPath), 'audio browser/API helpers should live in a route-local helper module');
  assert.ok(existsSync(typesPath), 'audio local contracts should live in a route-local type module');

  assert.match(workspaceSource, /from '\.\/_components\/audio-workspace-controls'/);
  assert.match(workspaceSource, /from '\.\/_components\/audio-generated-video-picker'/);
  assert.match(workspaceSource, /from '\.\/_lib\/audio-workspace-helpers'/);
  assert.match(workspaceSource, /from '\.\/_lib\/audio-workspace-types'/);
});

test('audio workspace does not regain extracted ownership', () => {
  assert.doesNotMatch(workspaceSource, /type SourceVideoState =/, 'source video contract belongs in _lib/audio-workspace-types.ts');
  assert.doesNotMatch(workspaceSource, /type AudioJobDetail =/, 'job detail contract belongs in _lib/audio-workspace-types.ts');
  assert.doesNotMatch(workspaceSource, /const DEFAULT_PACK:/, 'default audio settings belong in _lib/audio-workspace-helpers.ts');
  assert.doesNotMatch(workspaceSource, /function probeVideoDuration\(/, 'browser duration probing belongs in _lib/audio-workspace-helpers.ts');
  assert.doesNotMatch(workspaceSource, /async function uploadAsset\(/, 'upload helper belongs in _lib/audio-workspace-helpers.ts');
  assert.doesNotMatch(workspaceSource, /function AudioModePicker\(/, 'audio controls belong in _components/audio-workspace-controls.tsx');
  assert.doesNotMatch(workspaceSource, /function AudioSelectControl\(/, 'audio controls belong in _components/audio-workspace-controls.tsx');
  assert.doesNotMatch(workspaceSource, /generated-source-skeleton/, 'generated video picker UI belongs in _components/audio-generated-video-picker.tsx');
  assert.doesNotMatch(workspaceSource, /copy\.picker\.audioBadge/, 'generated video picker card UI belongs in _components/audio-generated-video-picker.tsx');

  const lineCount = workspaceSource.split('\n').length;
  assert.ok(lineCount <= 1160, `AudioWorkspace should stay below 1160 lines after generated picker extraction, got ${lineCount}`);
});

test('audio helper modules expose the expected workspace contract', () => {
  const controlsSource = readFileSync(controlsPath, 'utf8');
  const generatedPickerSource = readFileSync(generatedPickerPath, 'utf8');
  const helpersSource = readFileSync(helpersPath, 'utf8');
  const typesSource = readFileSync(typesPath, 'utf8');

  for (const exportName of [
    'AudioModePicker',
    'AudioSelectControl',
    'ToggleRow',
  ]) {
    assert.match(controlsSource, new RegExp(`export function ${exportName}`), `${exportName} should be exported`);
  }

  assert.match(
    generatedPickerSource,
    /export function AudioGeneratedVideoPickerModal/,
    'AudioGeneratedVideoPickerModal should be exported'
  );

  for (const exportName of [
    'DEFAULT_PACK',
    'DEFAULT_MOOD',
    'DEFAULT_INTENSITY',
    'AUDIO_VOICE_GENDER_VALUES',
    'resolveProviderLabel',
    'formatDateTime',
    'formatCopy',
    'formatCurrency',
    'resolveUiErrorMessage',
    'inferOutputKind',
    'probeVideoDuration',
    'uploadAsset',
    'fetchJobDetail',
  ]) {
    assert.match(helpersSource, new RegExp(`export (const|function|async function) ${exportName}`), `${exportName} should be exported`);
  }

  for (const typeName of [
    'SourceVideoState',
    'GeneratedSourceVideo',
    'AudioJobSettingsSnapshot',
    'AudioJobDetail',
    'ActiveAudioJobState',
    'AudioResultState',
  ]) {
    assert.match(typesSource, new RegExp(`export type ${typeName}`), `${typeName} should be exported`);
  }
});
