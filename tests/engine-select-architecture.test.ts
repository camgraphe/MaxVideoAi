import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const engineSelectPath = join(root, 'frontend/src/components/ui/EngineSelect.tsx');
const dropdownPath = join(root, 'frontend/src/components/ui/engine-select/EngineSelectDropdown.tsx');
const dropdownStateHookPath = join(root, 'frontend/src/components/ui/engine-select/useEngineSelectDropdownState.ts');
const registryHookPath = join(root, 'frontend/src/components/ui/engine-select/useEngineSelectRegistry.ts');
const modalPath = join(root, 'frontend/src/components/ui/engine-select/BrowseEnginesModal.tsx');
const helpersPath = join(root, 'frontend/src/components/ui/engine-select/engine-select-helpers.ts');
const copyPath = join(root, 'frontend/src/components/ui/engine-select/engine-select-copy.ts');
const typesPath = join(root, 'frontend/src/components/ui/engine-select/engine-select-types.ts');
const variantControlPath = join(root, 'frontend/src/components/ui/engine-select/EngineVariantControl.tsx');

const engineSelectSource = readFileSync(engineSelectPath, 'utf8');
const dropdownSource = readFileSync(dropdownPath, 'utf8');
const dropdownStateHookSource = readFileSync(dropdownStateHookPath, 'utf8');
const registryHookSource = readFileSync(registryHookPath, 'utf8');
const modalSource = readFileSync(modalPath, 'utf8');
const helpersSource = readFileSync(helpersPath, 'utf8');
const copySource = readFileSync(copyPath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');

test('engine select delegates modal rendering, copy, helpers, and contracts', () => {
  assert.ok(existsSync(modalPath), 'browse engines modal should live in a focused module');
  assert.ok(existsSync(dropdownPath), 'engine dropdown rendering should live in a focused module');
  assert.ok(existsSync(dropdownStateHookPath), 'engine dropdown state should live in a focused hook');
  assert.ok(existsSync(registryHookPath), 'engine registry state should live in a focused hook');
  assert.ok(existsSync(helpersPath), 'engine select helpers should live in a focused module');
  assert.ok(existsSync(copyPath), 'engine select default copy should live in a focused module');
  assert.ok(existsSync(typesPath), 'engine select contracts should live in a focused module');

  assert.match(engineSelectSource, /from '\.\/engine-select\/BrowseEnginesModal'/);
  assert.match(engineSelectSource, /from '\.\/engine-select\/EngineSelectDropdown'/);
  assert.match(engineSelectSource, /from '\.\/engine-select\/useEngineSelectDropdownState'/);
  assert.match(engineSelectSource, /from '\.\/engine-select\/useEngineSelectRegistry'/);
  assert.match(engineSelectSource, /from '\.\/engine-select\/engine-select-helpers'/);
  assert.match(engineSelectSource, /from '\.\/engine-select\/engine-select-copy'/);
  assert.match(engineSelectSource, /from '\.\/engine-select\/engine-select-types'/);
});

test('engine select does not regain extracted ownership', () => {
  assert.doesNotMatch(engineSelectSource, /function BrowseEnginesModal\(/, 'browse modal belongs in BrowseEnginesModal.tsx');
  assert.doesNotMatch(engineSelectSource, /createPortal/, 'dropdown portal rendering belongs in EngineSelectDropdown.tsx');
  assert.doesNotMatch(engineSelectSource, /localStorage\.getItem\(ENGINE_LEGACY_STORAGE_KEY\)/, 'legacy preference hydration belongs in useEngineSelectRegistry.ts');
  assert.doesNotMatch(engineSelectSource, /document\.addEventListener\('mousedown'/, 'dropdown dismissal belongs in useEngineSelectDropdownState.ts');
  assert.doesNotMatch(engineSelectSource, /function compareEnginesByDefaultPriority\(/, 'engine ordering belongs in engine-select-helpers.ts');
  assert.doesNotMatch(engineSelectSource, /const DEFAULT_ENGINE_SELECT_COPY =/, 'default copy belongs in engine-select-copy.ts');
  assert.doesNotMatch(engineSelectSource, /type EngineRegistryMeta =/, 'engine registry contracts belong in engine-select-types.ts');
  assert.doesNotMatch(engineSelectSource, /listFalEngines/, 'registry loading belongs in engine-select-helpers.ts');

  const lineCount = engineSelectSource.split('\n').length;
  assert.ok(lineCount <= 430, `EngineSelect should stay below 430 lines after state hook extraction, got ${lineCount}`);
});

test('engine select modules expose the expected contracts', () => {
  assert.match(dropdownSource, /export function EngineSelectDropdown/);
  assert.match(dropdownSource, /createPortal/);
  assert.match(dropdownSource, /getModeDisplayOrder/);
  assert.match(dropdownSource, /formatEngineSelectScore\(engineScores\?\.\[engine\.id\]\)/);
  assert.match(dropdownSource, /Score \$\{value\}\/10/);
  assert.doesNotMatch(dropdownSource, /formatEngineSelectScorePercent\(engineScores/);
  assert.match(dropdownSource, /grid min-h-\[250px\] min-w-0/);
  assert.match(dropdownSource, /overflow-x-auto overscroll-x-contain/);
  assert.match(dropdownSource, /max-h-\[min\(36vh,300px\)\]/);
  assert.match(dropdownStateHookSource, /export function useEngineSelectDropdownState/);
  assert.match(dropdownStateHookSource, /document\.addEventListener\('mousedown'/);
  assert.match(dropdownStateHookSource, /highlightedEngineIdRef/);
  assert.match(dropdownStateHookSource, /visibleEngines\.findIndex\(\(candidate\) => candidate\.id === highlightedEngineIdRef\.current\)/);
  assert.match(registryHookSource, /export function useEngineSelectRegistry/);
  assert.match(registryHookSource, /ENGINE_LEGACY_STORAGE_KEY/);
  assert.match(modalSource, /export function BrowseEnginesModal/);
  assert.match(helpersSource, /export async function ensureEngineRegistryMeta/);
  assert.match(helpersSource, /export function compareEnginesByDefaultPriority/);
  assert.match(helpersSource, /export const DEFAULT_MODE_OPTIONS/);
  assert.match(copySource, /export const DEFAULT_ENGINE_SELECT_COPY/);
  assert.match(typesSource, /export interface EngineSelectProps/);
  assert.match(typesSource, /export type EngineRegistryMeta/);
});

test('engine select delegates variant presentation to a focused component', () => {
  assert.ok(existsSync(variantControlPath));
  const variantControlSource = readFileSync(variantControlPath, 'utf8');
  assert.match(engineSelectSource, /from '.\/engine-select\/EngineVariantControl'/);
  assert.match(engineSelectSource, /<EngineVariantControl/);
  assert.match(variantControlSource, /export function EngineVariantControl/);
  assert.match(variantControlSource, /<SelectMenu/);
  assert.match(typesSource, /EngineSelectControlPresentation = 'default' \| 'workspace'/);
  assert.match(typesSource, /controlPresentation\?: EngineSelectControlPresentation/);
});

test('workspace variant trigger is compact and does not spend width on a chevron', () => {
  const variantControlSource = readFileSync(variantControlPath, 'utf8');
  assert.match(
    variantControlSource,
    /buttonClassName="!min-w-0 /,
    'workspace variant trigger must override the shared minimum width'
  );
  assert.match(variantControlSource, /w-\[104px\].*sm:w-\[124px\]/s);
  assert.match(variantControlSource, /h-\[42px\]/);
  assert.match(variantControlSource, /hideChevron/);
});

test('workspace engine and variant controls stay together without a Browse row', () => {
  const variantControlSource = readFileSync(variantControlPath, 'utf8');
  const workspaceBranch = engineSelectSource.match(
    /controlPresentation === 'workspace' \? \([\s\S]*?\n\s*\) : \(/,
  )?.[0] ?? '';

  assert.match(workspaceBranch, /flex min-w-0 flex-nowrap items-end gap-3/);
  assert.match(workspaceBranch, /<div className="min-w-0 flex-1">/);
  assert.match(engineSelectSource, /controlPresentation === 'workspace'\s*\? 'h-\[42px\]/);
  assert.doesNotMatch(workspaceBranch, /copy\.browseCompact|ExternalLink/);
  assert.match(engineSelectSource, /copy\.browse/);
  assert.match(engineSelectSource, /BrowseEnginesModal/);
  assert.doesNotMatch(
    workspaceBranch,
    /setBrowseOpen\(true\)/,
    'the workspace branch should not reserve a second Browse action row',
  );
  assert.match(variantControlSource, /title: disabledEngineReasons\?\.\[entry\.id\]/);
  assert.match(variantControlSource, /disabled: Boolean\(disabledEngineReasons\?\.\[entry\.id\]\)/);
});
