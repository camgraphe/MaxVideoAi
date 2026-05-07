import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const workspacePath = join(root, 'frontend/src/components/tools/CharacterBuilderWorkspace.tsx');
const copyPath = join(root, 'frontend/src/components/tools/character-builder/_lib/character-builder-copy.ts');
const typesPath = join(root, 'frontend/src/components/tools/character-builder/_lib/character-builder-types.ts');
const helpersPath = join(root, 'frontend/src/components/tools/character-builder/_lib/character-builder-helpers.ts');
const componentsPath = join(root, 'frontend/src/components/tools/character-builder/_components/character-builder-workspace-components.tsx');

const workspaceSource = readFileSync(workspacePath, 'utf8');

test('character builder workspace delegates copy, local types, and helper logic', () => {
  assert.ok(existsSync(copyPath), 'character builder copy should live in a colocated copy module');
  assert.ok(existsSync(typesPath), 'character builder local contracts should live in a colocated type module');
  assert.ok(existsSync(helpersPath), 'character builder helper logic should live in a colocated helper module');
  assert.ok(existsSync(componentsPath), 'character builder UI components should live in a colocated component module');

  assert.match(workspaceSource, /from '\.\/character-builder\/_components\/character-builder-workspace-components'/, 'workspace should import UI components');
  assert.match(workspaceSource, /from '\.\/character-builder\/_lib\/character-builder-copy'/, 'workspace should import character copy');
  assert.match(workspaceSource, /from '\.\/character-builder\/_lib\/character-builder-types'/, 'workspace should import local types');
  assert.match(workspaceSource, /from '\.\/character-builder\/_lib\/character-builder-helpers'/, 'workspace should import helpers');
});

test('character builder workspace does not regain extracted ownership', () => {
  assert.doesNotMatch(workspaceSource, /const DEFAULT_CHARACTER_COPY =/, 'default copy belongs in _lib/character-builder-copy.ts');
  assert.doesNotMatch(workspaceSource, /type UploadedAsset =/, 'asset contracts belong in _lib/character-builder-types.ts');
  assert.doesNotMatch(workspaceSource, /function readPersistedState\(/, 'persistence helpers belong in _lib/character-builder-helpers.ts');
  assert.doesNotMatch(workspaceSource, /function uploadImage\(/, 'upload helper belongs in _lib/character-builder-helpers.ts');
  assert.doesNotMatch(workspaceSource, /function getHairSummary\(/, 'trait summary helpers belong in _lib/character-builder-helpers.ts');
  assert.doesNotMatch(workspaceSource, /function VisualChoiceCard\(/, 'visual cards belong in _components/character-builder-workspace-components.tsx');
  assert.doesNotMatch(workspaceSource, /function HairEditorPanel\(/, 'hair editor UI belongs in _components/character-builder-workspace-components.tsx');
  assert.doesNotMatch(workspaceSource, /function CharacterReferenceLibraryModal\(/, 'library modal UI belongs in _components/character-builder-workspace-components.tsx');
  assert.doesNotMatch(workspaceSource, /function ResultCard\(/, 'result card UI belongs in _components/character-builder-workspace-components.tsx');

  const lineCount = workspaceSource.split('\n').length;
  assert.ok(lineCount <= 1950, `CharacterBuilderWorkspace should stay below 1950 lines after component extraction, got ${lineCount}`);
});

test('character builder helper modules expose the expected workspace contract', () => {
  const copySource = readFileSync(copyPath, 'utf8');
  const typesSource = readFileSync(typesPath, 'utf8');
  const helpersSource = readFileSync(helpersPath, 'utf8');
  const componentsSource = readFileSync(componentsPath, 'utf8');

  assert.match(copySource, /export const DEFAULT_CHARACTER_COPY =/, 'copy module should export default copy');
  assert.match(copySource, /export type CharacterCopy =/, 'copy module should export copy type');

  for (const typeName of [
    'UploadedAsset',
    'CharacterLibraryAsset',
    'CharacterLibraryAssetsResponse',
    'ChoiceOption',
    'ToggleItem',
    'BillingProductResponse',
    'LoadingRequestKey',
    'LoadingRequestCounts',
    'PendingCharacterRun',
    'CharacterJobPayload',
    'HistoricalCharacterGalleryItem',
  ]) {
    assert.match(typesSource, new RegExp(`export type ${typeName}`), `${typeName} should be exported`);
  }

  for (const exportName of [
    'INITIAL_LOADING_REQUEST_COUNTS',
    'CHARACTER_BUILDER_PENDING_RUNS_STORAGE_KEY',
    'readPersistedState',
    'writePersistedState',
    'readPersistedPendingRuns',
    'writePersistedPendingRuns',
    'buildRecoveredRunFromJob',
    'buildReferenceImage',
    'getRefByRole',
    'updateReferenceImage',
    'removeReferenceImage',
    'parseCharacterBuilderSnapshot',
    'getHairSummary',
    'getOutfitSummary',
    'buildResetCharacterBuilderState',
    'uploadImage',
  ]) {
    assert.match(helpersSource, new RegExp(`export (const|function|async function) ${exportName}`), `${exportName} should be exported`);
  }

  for (const exportName of [
    'VisualChoiceCard',
    'IconChoiceCard',
    'StyleChoiceCard',
    'OutputPreviewCard',
    'CharacterBuilderStickyDock',
    'HairEditorPanel',
    'SegmentedControl',
    'CompactSelectField',
    'MultiToggleGroup',
    'SectionTitle',
    'BuildLookCarouselCard',
    'ReferenceSlot',
    'CharacterReferenceLibraryModal',
    'ResultCard',
    'PendingResultCard',
    'EmptyResultsRail',
  ]) {
    assert.match(componentsSource, new RegExp(`export function ${exportName}`), `${exportName} should be exported`);
  }

  assert.match(componentsSource, /export type BuildLookSectionKey/, 'BuildLookSectionKey should be exported');
});
