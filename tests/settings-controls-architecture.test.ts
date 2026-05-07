import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const controlsPath = join(root, 'frontend/components/SettingsControls.tsx');
const partsPath = join(root, 'frontend/components/settings-controls/settings-control-parts.tsx');
const durationPath = join(root, 'frontend/components/settings-controls/settings-control-duration.ts');

const controlsSource = readFileSync(controlsPath, 'utf8');
const partsSource = readFileSync(partsPath, 'utf8');
const durationSource = readFileSync(durationPath, 'utf8');

test('settings controls delegates reusable control parts and duration helpers', () => {
  assert.ok(existsSync(partsPath), 'settings control subcomponents should live in a focused module');
  assert.ok(existsSync(durationPath), 'settings duration helpers should live in a focused module');

  assert.match(controlsSource, /from '@\/components\/settings-controls\/settings-control-parts'/);
  assert.match(controlsSource, /from '@\/components\/settings-controls\/settings-control-duration'/);
});

test('settings controls does not regain extracted ownership', () => {
  assert.doesNotMatch(controlsSource, /function FieldGroup\(/, 'FieldGroup belongs in settings-control-parts.tsx');
  assert.doesNotMatch(controlsSource, /function RangeWithInput\(/, 'RangeWithInput belongs in settings-control-parts.tsx');
  assert.doesNotMatch(controlsSource, /function parseDurationOptionValue\(/, 'duration parsing belongs in settings-control-duration.ts');
  assert.doesNotMatch(controlsSource, /type DurationOptionMeta =/, 'duration option contracts belong in settings-control-duration.ts');

  const lineCount = controlsSource.split('\n').length;
  assert.ok(lineCount <= 1205, `SettingsControls should stay below 1205 lines after subcomponent extraction, got ${lineCount}`);
});

test('settings control helper modules expose the expected contract', () => {
  assert.match(partsSource, /export function FieldGroup/);
  assert.match(partsSource, /export function RangeWithInput/);
  assert.match(durationSource, /export type DurationOptionMeta/);
  assert.match(durationSource, /export function parseDurationOptionValue/);
  assert.match(durationSource, /export function matchesDurationOptionValue/);
});
