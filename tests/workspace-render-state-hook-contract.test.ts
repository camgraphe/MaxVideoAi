import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('workspace render state and polling are owned by a route-local hook', () => {
  const appSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/AppClient.tsx'),
    'utf8'
  );
  const hookPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRenderState.ts'
  );
  assert.equal(fs.existsSync(hookPath), true);

  const hookSource = fs.readFileSync(hookPath, 'utf8');

  assert.match(appSource, /import \{ useWorkspaceRenderState \} from '\.\/_hooks\/useWorkspaceRenderState';/);
  assert.match(appSource, /useWorkspaceRenderState\(\{/);
  assert.doesNotMatch(appSource, /const \[renders, setRenders\] = useState<LocalRender\[]>/);
  assert.doesNotMatch(appSource, /const pendingPollRef = useRef/);
  assert.doesNotMatch(appSource, /const galleryRetentionTick/);
  assert.doesNotMatch(appSource, /buildPendingGroupSummaries\(/);

  assert.match(hookSource, /export function useWorkspaceRenderState/);
  assert.match(hookSource, /const hydratePendingRendersFromStorage = useCallback/);
  assert.match(hookSource, /getRendersNeedingStatusRefresh/);
  assert.match(hookSource, /mergeRecentJobsIntoLocalRenders/);
  assert.match(hookSource, /buildPendingGroupSummaries/);
});
