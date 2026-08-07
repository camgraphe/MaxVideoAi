import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { getBaseEngines } from '../frontend/src/lib/engines.ts';
import {
  UNIFIED_SEEDANCE_ENGINE_IDS,
  isUnifiedSeedanceEngineId,
} from '../frontend/lib/seedance-workflow.ts';
import { getWorkspaceAssetFieldRank } from '../frontend/components/composer/composer-layout.ts';
import {
  buildComposerModeToggles,
  getEngineModeOptions,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers.ts';
import { buildInitialWorkspaceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-hydration.ts';
import type { StoredFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state.ts';

const composerSource = readFileSync('frontend/components/Composer.tsx', 'utf8');
const composerLayoutSource = readFileSync('frontend/components/composer/composer-layout.ts', 'utf8');
const workspaceComposerSource = readFileSync(
  'frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx',
  'utf8',
);
const sidebarSource = readFileSync('frontend/components/AppSidebar.tsx', 'utf8');

function makeStoredForm(engineId: string): StoredFormState {
  return {
    engineId,
    mode: 't2v',
    durationSec: 5,
    resolution: '720p',
    aspectRatio: '16:9',
    fps: 24,
    iterations: 1,
    audio: true,
    extraInputValues: {},
  };
}

test('Seedance 2.5 uses the unified Seedance composer for all five supported modes', () => {
  const entry = listFalEngines().find(({ id }) => id === 'seedance-2-5');
  assert.ok(entry);

  assert.equal(UNIFIED_SEEDANCE_ENGINE_IDS.has('seedance-2-5'), true);
  assert.equal(isUnifiedSeedanceEngineId(entry.id), true);
  assert.deepEqual(entry.engine.modes, ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
  assert.equal(getEngineModeOptions(entry.engine), undefined);
  assert.deepEqual(
    buildComposerModeToggles({
      selectedEngine: entry.engine,
      audioWorkflowLocked: false,
      uiLocale: 'en',
      workflowCopy: {
        generateVideo: 'Generate Video',
        removeAudioToUnlock: 'Remove audio first',
        audioUnsupported: 'Audio unsupported',
        audioLocked: 'Audio locked',
        audioLockedFallback: 'Audio locked',
      },
    })?.map(({ mode }) => mode),
    [null, 'extend'],
  );
  assert.equal(getWorkspaceAssetFieldRank(entry.id, 'video_url'), 2);

  for (const source of [composerSource, composerLayoutSource, workspaceComposerSource]) {
    assert.doesNotMatch(source, /['"]seedance-2-5['"]/,
      'the flagship must reuse generic Seedance behavior rather than a dedicated component branch');
  }
  assert.match(composerSource, /UNIFIED_SEEDANCE_ENGINE_IDS\.has\(engine\.id\)/);
  assert.match(composerLayoutSource, /UNIFIED_SEEDANCE_ENGINE_IDS\.has\(engineId\)/);
});

test('workspace hydration preserves URL and stored choices while empty sessions use the flagship', () => {
  const engines = getBaseEngines();
  assert.equal(engines[0]?.id, 'seedance-2-5');

  for (const storedEngineId of ['seedance-2-0', 'kling-3-pro', 'veo-3-1']) {
    const result = buildInitialWorkspaceFormState({
      engines,
      storedFormRaw: makeStoredForm(storedEngineId),
      effectiveRequestedEngineId: null,
      effectiveRequestedEngineToken: '',
      effectiveRequestedMode: null,
    });
    assert.equal(result.form?.engineId, storedEngineId);
  }

  const requested = buildInitialWorkspaceFormState({
    engines,
    storedFormRaw: makeStoredForm('seedance-2-0'),
    effectiveRequestedEngineId: 'kling-3-pro',
    effectiveRequestedEngineToken: '',
    effectiveRequestedMode: 't2v',
  });
  assert.equal(requested.form?.engineId, 'kling-3-pro');

  const empty = buildInitialWorkspaceFormState({
    engines,
    storedFormRaw: null,
    effectiveRequestedEngineId: null,
    effectiveRequestedEngineToken: '',
    effectiveRequestedMode: null,
  });
  assert.equal(empty.form?.engineId, 'seedance-2-5');
});

test('workspace sidebar promotes the localized Seedance 2.5 launch card', () => {
  assert.match(sidebarSource, /href="\/app\?engine=seedance-2-5"/);

  const expected = {
    en: ['Seedance 2.5', 'Up to 30-second scenes', 'Images, references and video editing', 'Native audio workflow'],
    fr: ['Seedance 2.5', 'Scènes jusqu’à 30 secondes', 'Images, références et montage vidéo', 'Workflow audio natif'],
    es: ['Seedance 2.5', 'Escenas de hasta 30 segundos', 'Imágenes, referencias y edición de vídeo', 'Flujo de audio nativo'],
  } as const;

  for (const [locale, values] of Object.entries(expected)) {
    const dictionary = JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8'));
    const launchCard = dictionary.workspace.sidebar.newModel;
    assert.deepEqual(
      [launchCard.name, launchCard.quality1, launchCard.quality2, launchCard.quality3],
      values,
    );
  }
});
