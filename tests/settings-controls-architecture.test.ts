import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const controlsPath = join(root, 'frontend/components/SettingsControls.tsx');
const partsPath = join(root, 'frontend/components/settings-controls/settings-control-parts.tsx');
const durationPath = join(root, 'frontend/components/settings-controls/settings-control-duration.ts');
const copyPath = join(root, 'frontend/components/settings-controls/settings-control-copy.ts');
const genericFieldsPath = join(root, 'frontend/components/settings-controls/settings-control-generic-fields.tsx');
const typesPath = join(root, 'frontend/components/settings-controls/settings-control-types.ts');
const stateHookPath = join(root, 'frontend/components/settings-controls/useSettingsControlState.ts');

const controlsSource = readFileSync(controlsPath, 'utf8');
const partsSource = readFileSync(partsPath, 'utf8');
const durationSource = readFileSync(durationPath, 'utf8');
const copySource = readFileSync(copyPath, 'utf8');
const genericFieldsSource = readFileSync(genericFieldsPath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');
const stateHookSource = readFileSync(stateHookPath, 'utf8');

test('settings controls delegates reusable control parts and duration helpers', () => {
  assert.ok(existsSync(partsPath), 'settings control subcomponents should live in a focused module');
  assert.ok(existsSync(durationPath), 'settings duration helpers should live in a focused module');
  assert.ok(existsSync(copyPath), 'settings controls copy should live in a focused module');
  assert.ok(existsSync(genericFieldsPath), 'generic advanced fields should live in a focused module');
  assert.ok(existsSync(typesPath), 'settings controls props contract should live in a focused module');
  assert.ok(existsSync(stateHookPath), 'settings control derived state should live in a focused hook');

  assert.match(controlsSource, /from '@\/components\/settings-controls\/settings-control-parts'/);
  assert.match(controlsSource, /from '@\/components\/settings-controls\/settings-control-duration'/);
  assert.match(controlsSource, /from '@\/components\/settings-controls\/settings-control-copy'/);
  assert.match(controlsSource, /from '@\/components\/settings-controls\/settings-control-generic-fields'/);
  assert.match(controlsSource, /from '@\/components\/settings-controls\/settings-control-types'/);
  assert.match(controlsSource, /from '@\/components\/settings-controls\/useSettingsControlState'/);
});

test('settings controls does not regain extracted ownership', () => {
  assert.doesNotMatch(controlsSource, /function FieldGroup\(/, 'FieldGroup belongs in settings-control-parts.tsx');
  assert.doesNotMatch(controlsSource, /function RangeWithInput\(/, 'RangeWithInput belongs in settings-control-parts.tsx');
  assert.doesNotMatch(controlsSource, /function parseDurationOptionValue\(/, 'duration parsing belongs in settings-control-duration.ts');
  assert.doesNotMatch(controlsSource, /type DurationOptionMeta =/, 'duration option contracts belong in settings-control-duration.ts');
  assert.doesNotMatch(controlsSource, /const DEFAULT_CONTROLS_COPY =/, 'default copy belongs in settings-control-copy.ts');
  assert.doesNotMatch(controlsSource, /function mergeControlsCopy\(/, 'copy merging belongs in settings-control-copy.ts');
  assert.doesNotMatch(controlsSource, /function renderGenericAdvancedField/, 'generic field rendering belongs in settings-control-generic-fields.tsx');
  assert.doesNotMatch(controlsSource, /<select[\s\S]*field\.values/, 'generic enum field rendering belongs in settings-control-generic-fields.tsx');
  assert.doesNotMatch(controlsSource, /interface Props/, 'settings controls prop contract belongs in settings-control-types.ts');
  assert.doesNotMatch(controlsSource, /EngineInputField/, 'advanced field prop typing belongs in settings-control-types.ts');
  assert.doesNotMatch(controlsSource, /useEffect\(/, 'derived option syncing belongs in useSettingsControlState');
  assert.doesNotMatch(controlsSource, /parseDurationOptionValue/, 'duration option normalization belongs in useSettingsControlState');
  assert.doesNotMatch(controlsSource, /const resolutionOptions =/, 'resolution option derivation belongs in useSettingsControlState');

  const lineCount = controlsSource.split('\n').length;
  assert.ok(lineCount <= 950, `SettingsControls should stay below 950 lines after state hook extraction, got ${lineCount}`);
});

test('settings control helper modules expose the expected contract', () => {
  assert.match(partsSource, /export function FieldGroup/);
  assert.match(partsSource, /export function RangeWithInput/);
  assert.match(durationSource, /export type DurationOptionMeta/);
  assert.match(durationSource, /export function parseDurationOptionValue/);
  assert.match(durationSource, /export function matchesDurationOptionValue/);
  assert.match(copySource, /export const DEFAULT_CONTROLS_COPY/);
  assert.match(copySource, /export function mergeControlsCopy/);
  assert.match(genericFieldsSource, /export function SettingsGenericAdvancedFields/);
  assert.match(genericFieldsSource, /field\.type === 'enum'/);
  assert.match(genericFieldsSource, /field\.type === 'number'/);
  assert.match(typesSource, /export interface SettingsControlsProps/);
  assert.match(typesSource, /EngineInputField/);
  assert.match(stateHookSource, /export function useSettingsControlState/);
  assert.match(stateHookSource, /parseDurationOptionValue/);
  assert.match(stateHookSource, /matchesDurationOptionValue/);
  assert.match(stateHookSource, /setInternalCfgScale\(null\)/);
});
