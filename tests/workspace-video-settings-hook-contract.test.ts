import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('workspace video settings hydration is owned by a route-local hook', () => {
  const appSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/AppClient.tsx'),
    'utf8'
  );
  const hookPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceVideoSettings.ts'
  );
  const settingsPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings.ts'
  );
  const jobMediaPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_lib/workspace-video-job-media.ts'
  );
  assert.equal(fs.existsSync(hookPath), true);
  assert.equal(fs.existsSync(jobMediaPath), true);

  const hookSource = fs.readFileSync(hookPath, 'utf8');
  const settingsSource = fs.readFileSync(settingsPath, 'utf8');
  const jobMediaSource = fs.readFileSync(jobMediaPath, 'utf8');

  assert.match(appSource, /import \{ useWorkspaceVideoSettings \} from '\.\/_hooks\/useWorkspaceVideoSettings';/);
  assert.match(appSource, /useWorkspaceVideoSettings\(\{/);
  assert.doesNotMatch(appSource, /const applyVideoSettingsSnapshot = useCallback/);
  assert.doesNotMatch(appSource, /const hydrateVideoSettingsFromJob = useCallback/);
  assert.doesNotMatch(appSource, /const applyVideoSettingsFromTile = useCallback/);

  assert.match(hookSource, /export function useWorkspaceVideoSettings/);
  assert.match(hookSource, /const applyVideoSettingsSnapshot = useCallback/);
  assert.match(hookSource, /const hydrateVideoSettingsFromJob = useCallback/);
  assert.match(hookSource, /const applyVideoSettingsFromTile = useCallback/);
  assert.match(hookSource, /buildVideoSettingsSnapshotFromSharedVideo/);
  assert.match(hookSource, /buildRequestedJobPreview/);
  assert.match(hookSource, /const appliedSharedVideoIdRef = useRef<string \| null>\(null\)/);
  assert.match(hookSource, /claimSharedVideoHydration\(/);
  assert.match(hookSource, /appliedSharedVideoIdRef\.current = hydrationClaim\.nextAppliedVideoId/);

  const hydrationGuardIndex = hookSource.indexOf('if (!hydrationClaim.shouldApply || !sharedVideoSettings) return;');
  const snapshotApplicationIndex = hookSource.indexOf(
    'applyVideoSettingsSnapshot(buildVideoSettingsSnapshotFromSharedVideo(sharedVideoSettings));'
  );
  const jobHydrationIndex = hookSource.indexOf('void hydrateVideoSettingsFromJob(sharedVideoSettings.id);');
  assert.ok(hydrationGuardIndex >= 0, 'shared-video hydration should use the one-shot claim guard');
  assert.ok(
    hydrationGuardIndex < snapshotApplicationIndex,
    'the one-shot claim must guard snapshot application'
  );
  assert.ok(
    hydrationGuardIndex < jobHydrationIndex,
    'the one-shot claim must guard job hydration'
  );

  assert.match(settingsSource, /from '\.\/workspace-video-job-media'/);
  assert.match(jobMediaSource, /export function buildVideoJobMediaPatch/);
  assert.match(jobMediaSource, /export function buildRequestedJobPreview/);

  const settingsLineCount = settingsSource.split('\n').length;
  assert.ok(settingsLineCount <= 430, `workspace-video-settings should stay below 430 lines after job media extraction, got ${settingsLineCount}`);
});
