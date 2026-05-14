import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appClientPath = 'frontend/app/(core)/(workspace)/app/AppClient.tsx';
const draftStorageHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceDraftStorage.ts';
const draftHydrationHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceDraftHydration.ts';
const engineModeHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts';
const galleryActionsHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceGalleryActions.ts';
const appShellPath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceAppShell.tsx';
const appLoadStatePath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceAppLoadState.tsx';
const appReadyViewPath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceAppReadyView.tsx';
const bootSurfacePath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceBootSurface.tsx';
const centerGalleryPath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceCenterGallery.tsx';
const previewDockPath = 'frontend/app/(core)/(workspace)/app/_components/WorkspacePreviewDock.tsx';
const runtimeModalsPath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceRuntimeModals.tsx';

test('workspace draft storage and hydration are owned by route-local hooks', () => {
  assert.equal(existsSync(draftStorageHookPath), true);
  assert.equal(existsSync(draftHydrationHookPath), true);

  const appSource = readFileSync(appClientPath, 'utf8');
  const storageHookSource = readFileSync(draftStorageHookPath, 'utf8');
  const hydrationHookSource = readFileSync(draftHydrationHookPath, 'utf8');

  assert.match(appSource, /import \{ useWorkspaceDraftStorage \} from '\.\/_hooks\/useWorkspaceDraftStorage';/);
  assert.match(appSource, /import \{ useWorkspaceDraftHydration \} from '\.\/_hooks\/useWorkspaceDraftHydration';/);
  assert.match(appSource, /useWorkspaceDraftStorage\(\{/);
  assert.match(appSource, /useWorkspaceDraftHydration\(\{/);

  assert.doesNotMatch(appSource, /readWorkspaceStorage/);
  assert.doesNotMatch(appSource, /writeWorkspaceStorage/);
  assert.doesNotMatch(appSource, /readScopedWorkspaceStorage/);
  assert.doesNotMatch(appSource, /writeScopedWorkspaceStorage/);
  assert.doesNotMatch(appSource, /buildInitialWorkspaceFormState/);
  assert.doesNotMatch(appSource, /parseStoredMultiPromptScenes/);
  assert.doesNotMatch(appSource, /readStoredWorkspaceForm/);
  assert.doesNotMatch(appSource, /consumeWorkspaceOnboardingSkipIntent/);
  assert.doesNotMatch(appSource, /readLastKnownUserId/);
  assert.doesNotMatch(appSource, /writeStorage\(STORAGE_KEYS\./);

  assert.match(storageHookSource, /export function useWorkspaceDraftStorage/);
  assert.match(storageHookSource, /resolveWorkspaceRequestParams/);
  assert.match(storageHookSource, /consumeWorkspaceOnboardingSkipIntent/);
  assert.match(storageHookSource, /readLastKnownUserId/);
  assert.match(storageHookSource, /readWorkspaceStorage/);
  assert.match(storageHookSource, /writeWorkspaceStorage/);

  assert.match(hydrationHookSource, /export function useWorkspaceDraftHydration/);
  assert.match(hydrationHookSource, /buildInitialWorkspaceFormState/);
  assert.match(hydrationHookSource, /parseStoredMultiPromptScenes/);
  assert.match(hydrationHookSource, /readStoredWorkspaceForm/);
  assert.match(hydrationHookSource, /writeStorage\(STORAGE_KEYS\.form/);
  assert.match(hydrationHookSource, /hydratePendingRendersFromStorage/);
});

test('targeted engine links stay authoritative over stored drafts and guided samples', () => {
  const appSource = readFileSync(appClientPath, 'utf8');
  const engineModeHookSource = readFileSync(engineModeHookPath, 'utf8');
  const galleryActionsHookSource = readFileSync(galleryActionsHookPath, 'utf8');

  assert.match(engineModeHookSource, /matchesEngineToken\(engine, effectiveRequestedEngineToken\)/);
  assert.doesNotMatch(engineModeHookSource, /if\s*\(\s*hasStoredFormRef\.current\s*\)\s*return null;/);
  assert.doesNotMatch(engineModeHookSource, /if\s*\(\s*hasStoredFormRef\.current\s*\)\s*return;\s*setForm/);
  assert.match(engineModeHookSource, /candidate\?\.engineId !== nextState\.engineId/);

  assert.match(appSource, /suppressGuidedSampleAutoApply: Boolean\(draft\.effectiveRequestedEngineId \|\| draft\.effectiveRequestedEngineToken\)/);
  assert.match(galleryActionsHookSource, /suppressGuidedSampleAutoApply/);
  assert.match(galleryActionsHookSource, /if \(suppressGuidedSampleAutoApply\) return;/);
});

test('workspace app shell surfaces are split into route-local components', () => {
  assert.equal(existsSync(appShellPath), true);
  assert.equal(existsSync(appLoadStatePath), true);
  assert.equal(existsSync(appReadyViewPath), true);
  assert.equal(existsSync(bootSurfacePath), true);
  assert.equal(existsSync(centerGalleryPath), true);
  assert.equal(existsSync(previewDockPath), true);
  assert.equal(existsSync(runtimeModalsPath), true);

  const appSource = readFileSync(appClientPath, 'utf8');
  const appShellSource = readFileSync(appShellPath, 'utf8');
  const appLoadStateSource = readFileSync(appLoadStatePath, 'utf8');
  const appReadyViewSource = readFileSync(appReadyViewPath, 'utf8');
  const previewDockSource = readFileSync(previewDockPath, 'utf8');
  const modalsSource = readFileSync(runtimeModalsPath, 'utf8');

  assert.match(appSource, /import \{ WorkspaceAppReadyView \} from '\.\/_components\/WorkspaceAppReadyView';/);
  assert.match(appSource, /import \{ getWorkspaceAppLoadState \} from '\.\/_components\/WorkspaceAppLoadState';/);
  assert.match(appSource, /<WorkspaceAppReadyView/);
  assert.match(appSource, /getWorkspaceAppLoadState\(\{/);
  assert.doesNotMatch(appSource, /<WorkspaceAppShell/);
  assert.doesNotMatch(appSource, /<WorkspaceRuntimeModals/);
  assert.doesNotMatch(appSource, /<WorkspaceBootSurface/);
  assert.doesNotMatch(appSource, /<WorkspaceCenterGallery/);
  assert.doesNotMatch(appSource, /<WorkspacePreviewDock/);
  assert.doesNotMatch(appSource, /<WorkspaceChrome/);
  assert.doesNotMatch(appSource, /<GalleryRail/);

  assert.doesNotMatch(appSource, /<CompositePreviewDock/);
  assert.doesNotMatch(appSource, /<EngineSettingsBar/);
  assert.doesNotMatch(appSource, /<GroupedJobCard/);
  assert.doesNotMatch(appSource, /<WorkspaceTopUpModal/);
  assert.doesNotMatch(appSource, /<WorkspaceAuthGateModal/);
  assert.doesNotMatch(appSource, /<AssetLibraryModal/);

  assert.match(appReadyViewSource, /WorkspaceAppShell/);
  assert.match(appReadyViewSource, /WorkspaceRuntimeModals/);
  assert.match(appShellSource, /WorkspaceChrome/);
  assert.match(appShellSource, /GalleryRail/);
  assert.match(appShellSource, /WorkspaceCenterGallery/);
  assert.match(appShellSource, /WorkspacePreviewDock/);
  assert.match(appLoadStateSource, /WorkspaceBootSurface/);
  assert.match(appLoadStateSource, /loadEnginesError/);
  assert.match(previewDockSource, /CompositePreviewDock/);
  assert.match(previewDockSource, /EngineSettingsBar/);
  assert.match(modalsSource, /WorkspaceTopUpModal/);
  assert.match(modalsSource, /WorkspaceAuthGateModal/);
  assert.match(modalsSource, /AssetLibraryModal/);
});
