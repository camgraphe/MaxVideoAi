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
  assert.equal(fs.existsSync(hookPath), true);

  const hookSource = fs.readFileSync(hookPath, 'utf8');

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
});
