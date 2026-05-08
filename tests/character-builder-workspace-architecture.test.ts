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
const choiceCardsPath = join(root, 'frontend/src/components/tools/character-builder/_components/character-builder-choice-cards.tsx');
const generateDockPath = join(root, 'frontend/src/components/tools/character-builder/_components/character-builder-generate-dock.tsx');
const formControlsPath = join(root, 'frontend/src/components/tools/character-builder/_components/character-builder-form-controls.tsx');
const referenceLibraryPath = join(root, 'frontend/src/components/tools/character-builder/_components/character-builder-reference-library.tsx');
const resultCardsPath = join(root, 'frontend/src/components/tools/character-builder/_components/character-builder-result-cards.tsx');
const resultsGalleryPath = join(root, 'frontend/src/components/tools/character-builder/_components/character-builder-results-gallery.tsx');
const pageShellPath = join(root, 'frontend/src/components/tools/character-builder/_components/character-builder-page-shell.tsx');
const startSectionPath = join(root, 'frontend/src/components/tools/character-builder/_components/character-builder-start-section.tsx');
const optionsHookPath = join(root, 'frontend/src/components/tools/character-builder/_hooks/useCharacterBuilderOptions.ts');
const historicalResultsHookPath = join(root, 'frontend/src/components/tools/character-builder/_hooks/useCharacterBuilderHistoricalResults.ts');
const pendingRunsHookPath = join(root, 'frontend/src/components/tools/character-builder/_hooks/useCharacterBuilderPendingRunsSync.ts');
const jobSnapshotHookPath = join(root, 'frontend/src/components/tools/character-builder/_hooks/useCharacterBuilderJobSnapshotLoader.ts');
const generationRunnerHookPath = join(root, 'frontend/src/components/tools/character-builder/_hooks/useCharacterBuilderGenerationRunner.ts');
const referenceAssetsHookPath = join(root, 'frontend/src/components/tools/character-builder/_hooks/useCharacterBuilderReferenceAssets.ts');
const resultActionsHookPath = join(root, 'frontend/src/components/tools/character-builder/_hooks/useCharacterBuilderResultActions.ts');
const resultsInfiniteScrollHookPath = join(root, 'frontend/src/components/tools/character-builder/_hooks/useCharacterBuilderResultsInfiniteScroll.ts');
const persistenceHookPath = join(root, 'frontend/src/components/tools/character-builder/_hooks/useCharacterBuilderPersistence.ts');
const lookSummariesHookPath = join(root, 'frontend/src/components/tools/character-builder/_hooks/useCharacterBuilderLookSummaries.ts');
const traitActionsHookPath = join(root, 'frontend/src/components/tools/character-builder/_hooks/useCharacterBuilderTraitActions.ts');

const workspaceSource = readFileSync(workspacePath, 'utf8');

test('character builder workspace delegates copy, local types, and helper logic', () => {
  assert.ok(existsSync(copyPath), 'character builder copy should live in a colocated copy module');
  assert.ok(existsSync(typesPath), 'character builder local contracts should live in a colocated type module');
  assert.ok(existsSync(helpersPath), 'character builder helper logic should live in a colocated helper module');
  assert.ok(existsSync(componentsPath), 'character builder UI component barrel should live in a colocated component module');
  assert.ok(existsSync(choiceCardsPath), 'choice card components should live in a focused component module');
  assert.ok(existsSync(generateDockPath), 'generate dock components should live in a focused component module');
  assert.ok(existsSync(formControlsPath), 'form controls should live in a focused component module');
  assert.ok(existsSync(referenceLibraryPath), 'reference library components should live in a focused component module');
  assert.ok(existsSync(resultCardsPath), 'result card components should live in a focused component module');
  assert.ok(existsSync(resultsGalleryPath), 'result gallery composition should live in a focused component module');
  assert.ok(existsSync(pageShellPath), 'page shell and auth modal chrome should live in a focused component module');
  assert.ok(existsSync(startSectionPath), 'start section composition should live in a focused component module');
  assert.ok(existsSync(optionsHookPath), 'localized option derivation should live in a focused hook');
  assert.ok(existsSync(historicalResultsHookPath), 'historical result derivation should live in a focused hook');
  assert.ok(existsSync(pendingRunsHookPath), 'pending run polling should live in a focused hook');
  assert.ok(existsSync(jobSnapshotHookPath), 'job snapshot loading should live in a focused hook');
  assert.ok(existsSync(generationRunnerHookPath), 'generation submission should live in a focused hook');
  assert.ok(existsSync(referenceAssetsHookPath), 'reference asset upload and library selection should live in a focused hook');
  assert.ok(existsSync(resultActionsHookPath), 'result actions should live in a focused hook');
  assert.ok(existsSync(resultsInfiniteScrollHookPath), 'result infinite scroll should live in a focused hook');
  assert.ok(existsSync(persistenceHookPath), 'local persistence should live in a focused hook');
  assert.ok(existsSync(lookSummariesHookPath), 'look summaries should live in a focused hook');
  assert.ok(existsSync(traitActionsHookPath), 'trait actions should live in a focused hook');

  assert.match(workspaceSource, /from '\.\/character-builder\/_components\/character-builder-workspace-components'/, 'workspace should import UI components');
  assert.match(workspaceSource, /from '\.\/character-builder\/_components\/character-builder-page-shell'/, 'workspace should import page shell components');
  assert.match(workspaceSource, /from '\.\/character-builder\/_components\/character-builder-start-section'/, 'workspace should import start section component');
  assert.match(workspaceSource, /from '\.\/character-builder\/_hooks\/useCharacterBuilderOptions'/, 'workspace should import localized options hook');
  assert.match(workspaceSource, /from '\.\/character-builder\/_hooks\/useCharacterBuilderHistoricalResults'/, 'workspace should import historical results hook');
  assert.match(workspaceSource, /from '\.\/character-builder\/_hooks\/useCharacterBuilderPendingRunsSync'/, 'workspace should import pending run sync hook');
  assert.match(workspaceSource, /from '\.\/character-builder\/_hooks\/useCharacterBuilderJobSnapshotLoader'/, 'workspace should import job snapshot loader hook');
  assert.match(workspaceSource, /from '\.\/character-builder\/_hooks\/useCharacterBuilderGenerationRunner'/, 'workspace should import generation runner hook');
  assert.match(workspaceSource, /from '\.\/character-builder\/_hooks\/useCharacterBuilderReferenceAssets'/, 'workspace should import reference asset hook');
  assert.match(workspaceSource, /from '\.\/character-builder\/_hooks\/useCharacterBuilderResultActions'/, 'workspace should import result actions hook');
  assert.match(workspaceSource, /from '\.\/character-builder\/_hooks\/useCharacterBuilderResultsInfiniteScroll'/, 'workspace should import result infinite scroll hook');
  assert.match(workspaceSource, /from '\.\/character-builder\/_hooks\/useCharacterBuilderPersistence'/, 'workspace should import persistence hook');
  assert.match(workspaceSource, /from '\.\/character-builder\/_hooks\/useCharacterBuilderLookSummaries'/, 'workspace should import look summaries hook');
  assert.match(workspaceSource, /from '\.\/character-builder\/_hooks\/useCharacterBuilderTraitActions'/, 'workspace should import trait actions hook');
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
  assert.doesNotMatch(workspaceSource, /GENDER_PRESENTATION_OPTIONS\.map/, 'localized option derivation belongs in useCharacterBuilderOptions');
  assert.doesNotMatch(workspaceSource, /useInfiniteJobs\(18, \{ surface: 'character' \}\)/, 'historical result feed belongs in useCharacterBuilderHistoricalResults');
  assert.doesNotMatch(workspaceSource, /localResultUrls/, 'historical duplicate filtering belongs in useCharacterBuilderHistoricalResults');
  assert.doesNotMatch(workspaceSource, /function syncPendingRuns\(/, 'pending run polling belongs in useCharacterBuilderPendingRunsSync');
  assert.doesNotMatch(workspaceSource, /function loadFromJob\(/, 'job query hydration belongs in useCharacterBuilderJobSnapshotLoader');
  assert.doesNotMatch(workspaceSource, /async function handleRun\(/, 'generation submission belongs in useCharacterBuilderGenerationRunner');
  assert.doesNotMatch(workspaceSource, /runCharacterBuilderTool/, 'generation API calls belong in useCharacterBuilderGenerationRunner');
  assert.doesNotMatch(workspaceSource, /emitClientMetric\('tool_start'/, 'generation analytics belong in useCharacterBuilderGenerationRunner');
  assert.doesNotMatch(workspaceSource, /async function handleUpload\(/, 'reference upload handling belongs in useCharacterBuilderReferenceAssets');
  assert.doesNotMatch(workspaceSource, /function handleLibrarySelect\(/, 'reference library selection belongs in useCharacterBuilderReferenceAssets');
  assert.doesNotMatch(workspaceSource, /buildReferenceImage/, 'reference image construction belongs in useCharacterBuilderReferenceAssets');
  assert.doesNotMatch(workspaceSource, /async function handleSaveResult\(/, 'result save actions belong in useCharacterBuilderResultActions');
  assert.doesNotMatch(workspaceSource, /async function handleSaveHistoricalResult\(/, 'historical save actions belong in useCharacterBuilderResultActions');
  assert.doesNotMatch(workspaceSource, /async function handleDuplicateHistoricalSettings\(/, 'historical duplicate actions belong in useCharacterBuilderResultActions');
  assert.doesNotMatch(workspaceSource, /function applySettingsSnapshot\(/, 'result snapshot application belongs in useCharacterBuilderResultActions');
  assert.doesNotMatch(workspaceSource, /saveImageToLibrary/, 'result library saving belongs in useCharacterBuilderResultActions');
  assert.doesNotMatch(workspaceSource, /parseCharacterBuilderSnapshot/, 'historical snapshot parsing belongs in useCharacterBuilderResultActions');
  assert.doesNotMatch(workspaceSource, /triggerAppDownload/, 'result downloads belong in CharacterBuilderResultsGallery');
  assert.doesNotMatch(workspaceSource, /new IntersectionObserver/, 'result infinite scroll observer belongs in useCharacterBuilderResultsInfiniteScroll');
  assert.doesNotMatch(workspaceSource, /scrollContainer\.addEventListener/, 'result scroll listener belongs in useCharacterBuilderResultsInfiniteScroll');
  assert.doesNotMatch(workspaceSource, /<ResultCard/, 'result card composition belongs in CharacterBuilderResultsGallery');
  assert.doesNotMatch(workspaceSource, /<HeaderBar/, 'page chrome belongs in CharacterBuilderPageFrame');
  assert.doesNotMatch(workspaceSource, /<AppSidebar/, 'page sidebar chrome belongs in CharacterBuilderPageFrame');
  assert.doesNotMatch(workspaceSource, /fixed inset-0 z-\[10050\]/, 'auth gate modal UI belongs in CharacterBuilderAuthGateModal');
  assert.doesNotMatch(workspaceSource, /readPersistedState\(\)/, 'local hydration belongs in useCharacterBuilderPersistence');
  assert.doesNotMatch(workspaceSource, /writePersistedPendingRuns/, 'pending run persistence belongs in useCharacterBuilderPersistence');
  assert.doesNotMatch(workspaceSource, /visitorSanitizedRef/, 'visitor cleanup tracking belongs in useCharacterBuilderPersistence');
  assert.doesNotMatch(workspaceSource, /function updateTrait</, 'trait updates belong in useCharacterBuilderTraitActions');
  assert.doesNotMatch(workspaceSource, /function toggleListValue\(/, 'trait list toggles belong in useCharacterBuilderTraitActions');
  assert.doesNotMatch(workspaceSource, /function addMustRemainTag\(/, 'must-remain tag creation belongs in useCharacterBuilderTraitActions');
  assert.doesNotMatch(workspaceSource, /function removeMustRemainTag\(/, 'must-remain tag removal belongs in useCharacterBuilderTraitActions');
  assert.doesNotMatch(workspaceSource, /const identitySummary =/, 'look summary derivation belongs in useCharacterBuilderLookSummaries');
  assert.doesNotMatch(workspaceSource, /const accessoriesFeaturesSummary =/, 'accessory summary derivation belongs in useCharacterBuilderLookSummaries');
  assert.doesNotMatch(workspaceSource, /<OutputPreviewCard/, 'output mode selection belongs in CharacterBuilderStartSection');
  assert.doesNotMatch(workspaceSource, /<ReferenceSlot/, 'reference slot composition belongs in CharacterBuilderStartSection');
  assert.doesNotMatch(workspaceSource, /copy\.references\.addInspiration/, 'style inspiration empty slot belongs in CharacterBuilderStartSection');

  const lineCount = workspaceSource.split('\n').length;
  assert.ok(lineCount <= 970, `CharacterBuilderWorkspace should stay below 970 lines after start section extraction, got ${lineCount}`);
});

test('character builder helper modules expose the expected workspace contract', () => {
  const copySource = readFileSync(copyPath, 'utf8');
  const typesSource = readFileSync(typesPath, 'utf8');
  const helpersSource = readFileSync(helpersPath, 'utf8');
  const componentsSource = readFileSync(componentsPath, 'utf8');
  const choiceCardsSource = readFileSync(choiceCardsPath, 'utf8');
  const generateDockSource = readFileSync(generateDockPath, 'utf8');
  const formControlsSource = readFileSync(formControlsPath, 'utf8');
  const referenceLibrarySource = readFileSync(referenceLibraryPath, 'utf8');
  const resultCardsSource = readFileSync(resultCardsPath, 'utf8');
  const resultsGallerySource = readFileSync(resultsGalleryPath, 'utf8');
  const pageShellSource = readFileSync(pageShellPath, 'utf8');
  const startSectionSource = readFileSync(startSectionPath, 'utf8');
  const optionsHookSource = readFileSync(optionsHookPath, 'utf8');
  const historicalResultsHookSource = readFileSync(historicalResultsHookPath, 'utf8');
  const pendingRunsHookSource = readFileSync(pendingRunsHookPath, 'utf8');
  const jobSnapshotHookSource = readFileSync(jobSnapshotHookPath, 'utf8');
  const generationRunnerHookSource = readFileSync(generationRunnerHookPath, 'utf8');
  const referenceAssetsHookSource = readFileSync(referenceAssetsHookPath, 'utf8');
  const resultActionsHookSource = readFileSync(resultActionsHookPath, 'utf8');
  const resultsInfiniteScrollHookSource = readFileSync(resultsInfiniteScrollHookPath, 'utf8');
  const persistenceHookSource = readFileSync(persistenceHookPath, 'utf8');
  const lookSummariesHookSource = readFileSync(lookSummariesHookPath, 'utf8');
  const traitActionsHookSource = readFileSync(traitActionsHookPath, 'utf8');

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

  for (const moduleName of [
    './character-builder-choice-cards',
    './character-builder-generate-dock',
    './character-builder-form-controls',
    './character-builder-reference-library',
    './character-builder-result-cards',
    './character-builder-results-gallery',
  ]) {
    assert.match(componentsSource, new RegExp(`from '${moduleName}'`), `component barrel should re-export ${moduleName}`);
  }

  assert.doesNotMatch(componentsSource, /export function VisualChoiceCard\(/, 'choice cards should not be implemented in the barrel');
  assert.doesNotMatch(componentsSource, /export function HairEditorPanel\(/, 'form controls should not be implemented in the barrel');
  assert.doesNotMatch(componentsSource, /export function CharacterReferenceLibraryModal\(/, 'library modal should not be implemented in the barrel');
  assert.doesNotMatch(componentsSource, /export function ResultCard\(/, 'result cards should not be implemented in the barrel');
  assert.doesNotMatch(componentsSource, /export function CharacterBuilderResultsGallery\(/, 'result gallery should not be implemented in the barrel');

  for (const exportName of [
    'VisualChoiceCard',
    'IconChoiceCard',
    'StyleChoiceCard',
    'OutputPreviewCard',
  ]) {
    assert.match(choiceCardsSource, new RegExp(`export function ${exportName}`), `${exportName} should be exported`);
  }

  assert.match(generateDockSource, /export function CharacterBuilderStickyDock/, 'CharacterBuilderStickyDock should be exported');
  assert.match(startSectionSource, /export function CharacterBuilderStartSection/, 'CharacterBuilderStartSection should be exported');
  assert.match(startSectionSource, /OutputPreviewCard/, 'start section should own output mode selection');
  assert.match(startSectionSource, /ReferenceSlot/, 'start section should own reference slot composition');
  assert.match(startSectionSource, /copy\.references\.addInspiration/, 'start section should own style inspiration empty slot');

  for (const exportName of [
    'HairEditorPanel',
    'SegmentedControl',
    'CompactSelectField',
    'MultiToggleGroup',
    'SectionTitle',
    'BuildLookCarouselCard',
  ]) {
    assert.match(formControlsSource, new RegExp(`export function ${exportName}`), `${exportName} should be exported`);
  }

  assert.match(formControlsSource, /export type BuildLookSectionKey/, 'BuildLookSectionKey should be exported');

  for (const exportName of [
    'ReferenceSlot',
    'CharacterReferenceLibraryModal',
  ]) {
    assert.match(referenceLibrarySource, new RegExp(`export function ${exportName}`), `${exportName} should be exported`);
  }

  for (const exportName of [
    'ResultCard',
    'PendingResultCard',
    'EmptyResultsRail',
  ]) {
    assert.match(resultCardsSource, new RegExp(`export function ${exportName}`), `${exportName} should be exported`);
  }

  assert.match(resultsGallerySource, /export function CharacterBuilderResultsGallery/, 'results gallery should be exported');
  assert.match(resultsGallerySource, /<ResultCard/, 'results gallery should compose result cards');
  assert.match(resultsGallerySource, /triggerAppDownload/, 'results gallery should own downloads');
  assert.match(pageShellSource, /export function CharacterBuilderPageFrame/, 'page shell should export the workspace frame');
  assert.match(pageShellSource, /export function CharacterBuilderLoadingSkeleton/, 'page shell should export the loading skeleton');
  assert.match(pageShellSource, /export function CharacterBuilderDisabledState/, 'page shell should export the disabled state');
  assert.match(pageShellSource, /export function CharacterBuilderAuthGateModal/, 'page shell should export the auth gate modal');

  assert.match(optionsHookSource, /export function useCharacterBuilderOptions/, 'options hook should be exported');
  assert.match(optionsHookSource, /getAvailableCharacterFormatOptions/, 'options hook should own format option derivation');
  assert.match(historicalResultsHookSource, /export function useCharacterBuilderHistoricalResults/, 'historical results hook should be exported');
  assert.match(historicalResultsHookSource, /useInfiniteJobs\(18, \{ surface: 'character' \}\)/, 'historical results hook should own the character feed');
  assert.match(pendingRunsHookSource, /export function useCharacterBuilderPendingRunsSync/, 'pending run sync hook should be exported');
  assert.match(pendingRunsHookSource, /buildRecoveredRunFromJob/, 'pending run sync hook should recover completed runs');
  assert.match(jobSnapshotHookSource, /export function useCharacterBuilderJobSnapshotLoader/, 'job snapshot loader hook should be exported');
  assert.match(jobSnapshotHookSource, /parseCharacterBuilderSnapshot/, 'job snapshot loader hook should own query hydration parsing');
  assert.match(generationRunnerHookSource, /export function useCharacterBuilderGenerationRunner/, 'generation runner hook should be exported');
  assert.match(generationRunnerHookSource, /runCharacterBuilderTool/, 'generation runner hook should submit character jobs');
  assert.match(generationRunnerHookSource, /emitClientMetric\('tool_start'/, 'generation runner hook should own generation analytics');
  assert.match(generationRunnerHookSource, /normalizeHairAndOutfitModes/, 'generation runner hook should own request trait normalization');
  assert.match(referenceAssetsHookSource, /export function useCharacterBuilderReferenceAssets/, 'reference asset hook should be exported');
  assert.match(referenceAssetsHookSource, /uploadImage/, 'reference asset hook should own uploads');
  assert.match(referenceAssetsHookSource, /buildReferenceImage/, 'reference asset hook should build uploaded references');
  assert.match(referenceAssetsHookSource, /updateReferenceImage/, 'reference asset hook should update reference slots');
  assert.match(resultActionsHookSource, /export function useCharacterBuilderResultActions/, 'result actions hook should be exported');
  assert.match(resultActionsHookSource, /saveImageToLibrary/, 'result actions hook should own library saves');
  assert.match(resultActionsHookSource, /parseCharacterBuilderSnapshot/, 'result actions hook should own historical snapshot parsing');
  assert.match(resultsInfiniteScrollHookSource, /export function useCharacterBuilderResultsInfiniteScroll/, 'results scroll hook should be exported');
  assert.match(resultsInfiniteScrollHookSource, /new IntersectionObserver/, 'results scroll hook should own the observer');
  assert.match(resultsInfiniteScrollHookSource, /scrollContainer\.addEventListener/, 'results scroll hook should own scroll fallback loading');
  assert.match(persistenceHookSource, /export function useCharacterBuilderPersistence/, 'persistence hook should be exported');
  assert.match(persistenceHookSource, /readPersistedState/, 'persistence hook should own local hydration');
  assert.match(persistenceHookSource, /writePersistedPendingRuns/, 'persistence hook should own pending run persistence');
  assert.match(lookSummariesHookSource, /export function useCharacterBuilderLookSummaries/, 'look summaries hook should be exported');
  assert.match(lookSummariesHookSource, /getHairSummary/, 'look summaries hook should own hair summary derivation');
  assert.match(lookSummariesHookSource, /countConfiguredSecondaryControls/, 'look summaries hook should own secondary control counts');
  assert.match(traitActionsHookSource, /export function useCharacterBuilderTraitActions/, 'trait actions hook should be exported');
  assert.match(traitActionsHookSource, /const updateTrait = useCallback/, 'trait actions hook should own trait updates');
  assert.match(traitActionsHookSource, /const handleResetBuilder = useCallback/, 'trait actions hook should own reset orchestration');
});
