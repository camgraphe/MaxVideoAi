import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { getSeedanceFieldBlockKey, getUnifiedSeedanceMode, isUnifiedSeedanceEngineId } from '../frontend/lib/seedance-workflow.ts';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { buildComposerModeToggles } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers.ts';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema.ts';

const appClientPath = 'frontend/app/(core)/(workspace)/app/AppClient.tsx';
const readyViewPath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceAppReadyView.tsx';
const composerSurfacePath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx';
const workspaceCopyPath = 'frontend/app/(core)/(workspace)/app/_lib/workspace-copy.ts';

test('workspace composer and settings surface is owned by a route-local component', () => {
  assert.equal(existsSync(readyViewPath), true);
  assert.equal(existsSync(composerSurfacePath), true);

  const appSource = readFileSync(appClientPath, 'utf8');
  const readyViewSource = readFileSync(readyViewPath, 'utf8');
  const surfaceSource = readFileSync(composerSurfacePath, 'utf8');

  assert.match(appSource, /import \{ WorkspaceAppReadyView \} from '\.\/_components\/WorkspaceAppReadyView';/);
  assert.doesNotMatch(appSource, /WorkspaceComposerSurface/);
  assert.match(readyViewSource, /import \{ WorkspaceComposerSurface \} from '\.\/WorkspaceComposerSurface';/);
  assert.match(readyViewSource, /<WorkspaceComposerSurface/);

  assert.doesNotMatch(appSource, /<Composer\b/);
  assert.doesNotMatch(appSource, /<SettingsControls\b/);
  assert.doesNotMatch(appSource, /<CoreSettingsBar\b/);
  assert.doesNotMatch(appSource, /<KlingElementsBuilder\b/);
  assert.doesNotMatch(appSource, /buildComposerAttachments/);
  assert.doesNotMatch(appSource, /buildComposerPromotedActions/);
  assert.doesNotMatch(appSource, /normalizeExtraInputValue/);
  assert.doesNotMatch(appSource, /getSeedanceFieldBlockKey/);
  assert.doesNotMatch(appSource, /MULTI_PROMPT_MIN_SEC/);
  assert.doesNotMatch(appSource, /getLocalizedModeLabel/);

  assert.match(surfaceSource, /export function WorkspaceComposerSurface/);
  assert.match(surfaceSource, /<Composer\b/);
  assert.match(surfaceSource, /<SettingsControls\b/);
  assert.match(surfaceSource, /<CoreSettingsBar\b/);
  assert.match(surfaceSource, /KlingElementsBuilder/);
  assert.match(surfaceSource, /buildComposerAttachments/);
  assert.match(surfaceSource, /buildComposerPromotedActions/);
  assert.match(surfaceSource, /normalizeExtraInputValue/);
  assert.match(surfaceSource, /getSeedanceFieldBlockKey/);
  assert.match(surfaceSource, /MULTI_PROMPT_MIN_SEC/);
  assert.match(surfaceSource, /getLocalizedModeLabel/);
});

test('workspace video composer shows in-progress render banner from pending groups', () => {
  assert.equal(existsSync(readyViewPath), true);
  assert.equal(existsSync(composerSurfacePath), true);
  assert.equal(existsSync(workspaceCopyPath), true);

  const readyViewSource = readFileSync(readyViewPath, 'utf8');
  const surfaceSource = readFileSync(composerSurfacePath, 'utf8');
  const copySource = readFileSync(workspaceCopyPath, 'utf8');

  assert.match(copySource, /generatingInProgress:/);
  assert.match(readyViewSource, /buildWorkspaceInProgressMessage\(pendingGroups\.length, workspaceCopy\)/);
  assert.match(readyViewSource, /inProgressMessage=\{inProgressMessage\}/);
  assert.match(surfaceSource, /inProgressMessage: string \| null;/);
  assert.match(surfaceSource, /role="status"/);
  assert.match(surfaceSource, /aria-live="polite"/);
  assert.match(surfaceSource, /bg-success-bg/);
});

test('workspace treats Seedance 2.0 Mini as a unified Seedance workflow', () => {
  assert.equal(isUnifiedSeedanceEngineId('seedance-2-0-mini'), true);

  const referenceAssets = {
    image_urls: [{ kind: 'image' as const }],
    video_urls: [{ kind: 'video' as const }],
  };
  assert.equal(getUnifiedSeedanceMode(referenceAssets), 'ref2v');
  assert.equal(getSeedanceFieldBlockKey('image_url', referenceAssets), 'clearReferences');

  const sourceVideoAssets = {
    video_url: [{ kind: 'video' as const }],
  };
  assert.equal(getUnifiedSeedanceMode(sourceVideoAssets), 'v2v');
  assert.equal(getSeedanceFieldBlockKey('image_url', sourceVideoAssets), 'clearReferences');

  const videoOnlyReferenceAssets = {
    video_urls: [{ kind: 'video' as const }],
  };
  assert.equal(getUnifiedSeedanceMode(videoOnlyReferenceAssets), 'ref2v');
  assert.equal(getSeedanceFieldBlockKey('end_image_url', videoOnlyReferenceAssets), 'clearReferences');
});

test('workspace exposes Seedance 2.0 Mini source-video fields in the unified composer schema', () => {
  const mini = listFalEngines().find((entry) => entry.id === 'seedance-2-0-mini');
  assert.ok(mini);

  const schema = summarizeWorkspaceInputSchema({
    selectedEngine: mini.engine,
    activeMode: 't2v',
    allowsUnifiedVeoFirstLast: false,
    isUnifiedHappyHorse: false,
    isUnifiedSeedance: true,
    uiLocale: 'en',
  });

  assert.deepEqual(new Set(schema.assetFields.map(({ field }) => field.id)), new Set([
    'image_url',
    'end_image_url',
    'image_urls',
    'video_url',
    'video_urls',
    'audio_urls',
  ]));
});

test('workspace keeps BytePlus-only Seedance source video fields out of Fal-routed Standard and Fast composers', () => {
  for (const engineId of ['seedance-2-0', 'seedance-2-0-fast']) {
    const entry = listFalEngines().find((engine) => engine.id === engineId);
    assert.ok(entry);

    const schema = summarizeWorkspaceInputSchema({
      selectedEngine: entry.engine,
      activeMode: 't2v',
      allowsUnifiedVeoFirstLast: false,
      isUnifiedHappyHorse: false,
      isUnifiedSeedance: true,
      uiLocale: 'en',
    });
    const assetIds = schema.assetFields.map(({ field }) => field.id);

    assert.equal(assetIds.includes('video_url'), false);
    assert.equal(assetIds.includes('extension_source_videos'), false);
  }
});

test('workspace exposes only source clips in the Seedance 2.0 Mini extension schema', () => {
  const mini = listFalEngines().find((entry) => entry.id === 'seedance-2-0-mini');
  assert.ok(mini);

  const schema = summarizeWorkspaceInputSchema({
    selectedEngine: mini.engine,
    activeMode: 'extend',
    allowsUnifiedVeoFirstLast: false,
    isUnifiedHappyHorse: false,
    isUnifiedSeedance: true,
    uiLocale: 'en',
  });

  assert.deepEqual(schema.assetFields.map(({ field }) => field.id), ['extension_source_videos']);
  assert.equal(schema.assetFields[0]?.field.label, 'Source clips to extend (up to 3)');
  assert.equal(schema.assetFields[0]?.required, true);
  assert.equal(schema.assetFields[0]?.role, 'generic');
});

test('workspace exposes Seedance 2.0 Mini extension as an explicit composer mode', () => {
  const mini = listFalEngines().find((entry) => entry.id === 'seedance-2-0-mini');
  assert.ok(mini);

  const toggles = buildComposerModeToggles({
    selectedEngine: mini.engine,
    audioWorkflowLocked: false,
    uiLocale: 'en',
    workflowCopy: {
      generateVideo: 'Generate Video',
      removeAudioToUnlock: 'Remove audio first',
      audioUnsupported: 'Audio unsupported',
      audioLocked: 'Audio locked',
      audioLockedFallback: 'Audio locked',
    },
  });

  assert.deepEqual(toggles?.map(({ mode }) => mode), [null, 'extend']);
  assert.deepEqual(toggles?.map(({ label }) => label), ['Generate Video', 'Extend Video']);
});
