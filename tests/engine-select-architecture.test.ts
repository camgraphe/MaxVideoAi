import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const engineSelectPath = join(root, 'frontend/src/components/ui/EngineSelect.tsx');
const modalPath = join(root, 'frontend/src/components/ui/engine-select/BrowseEnginesModal.tsx');
const helpersPath = join(root, 'frontend/src/components/ui/engine-select/engine-select-helpers.ts');
const copyPath = join(root, 'frontend/src/components/ui/engine-select/engine-select-copy.ts');
const typesPath = join(root, 'frontend/src/components/ui/engine-select/engine-select-types.ts');

const engineSelectSource = readFileSync(engineSelectPath, 'utf8');
const modalSource = readFileSync(modalPath, 'utf8');
const helpersSource = readFileSync(helpersPath, 'utf8');
const copySource = readFileSync(copyPath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');

test('engine select delegates modal rendering, copy, helpers, and contracts', () => {
  assert.ok(existsSync(modalPath), 'browse engines modal should live in a focused module');
  assert.ok(existsSync(helpersPath), 'engine select helpers should live in a focused module');
  assert.ok(existsSync(copyPath), 'engine select default copy should live in a focused module');
  assert.ok(existsSync(typesPath), 'engine select contracts should live in a focused module');

  assert.match(engineSelectSource, /from '\.\/engine-select\/BrowseEnginesModal'/);
  assert.match(engineSelectSource, /from '\.\/engine-select\/engine-select-helpers'/);
  assert.match(engineSelectSource, /from '\.\/engine-select\/engine-select-copy'/);
  assert.match(engineSelectSource, /from '\.\/engine-select\/engine-select-types'/);
});

test('engine select does not regain extracted ownership', () => {
  assert.doesNotMatch(engineSelectSource, /function BrowseEnginesModal\(/, 'browse modal belongs in BrowseEnginesModal.tsx');
  assert.doesNotMatch(engineSelectSource, /function compareEnginesByDefaultPriority\(/, 'engine ordering belongs in engine-select-helpers.ts');
  assert.doesNotMatch(engineSelectSource, /const DEFAULT_ENGINE_SELECT_COPY =/, 'default copy belongs in engine-select-copy.ts');
  assert.doesNotMatch(engineSelectSource, /type EngineRegistryMeta =/, 'engine registry contracts belong in engine-select-types.ts');
  assert.doesNotMatch(engineSelectSource, /listFalEngines/, 'registry loading belongs in engine-select-helpers.ts');

  const lineCount = engineSelectSource.split('\n').length;
  assert.ok(lineCount <= 760, `EngineSelect should stay below 760 lines after modal/helper extraction, got ${lineCount}`);
});

test('engine select modules expose the expected contracts', () => {
  assert.match(modalSource, /export function BrowseEnginesModal/);
  assert.match(helpersSource, /export async function ensureEngineRegistryMeta/);
  assert.match(helpersSource, /export function compareEnginesByDefaultPriority/);
  assert.match(helpersSource, /export const DEFAULT_MODE_OPTIONS/);
  assert.match(copySource, /export const DEFAULT_ENGINE_SELECT_COPY/);
  assert.match(typesSource, /export interface EngineSelectProps/);
  assert.match(typesSource, /export type EngineRegistryMeta/);
});
