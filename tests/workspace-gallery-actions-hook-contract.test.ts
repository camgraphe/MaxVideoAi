import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('workspace gallery actions are owned by a route-local hook', () => {
  const appSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/AppClient.tsx'),
    'utf8'
  );
  const hookPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceGalleryActions.ts'
  );
  assert.equal(fs.existsSync(hookPath), true);

  const hookSource = fs.readFileSync(hookPath, 'utf8');

  assert.match(appSource, /import \{ useWorkspaceGalleryActions \} from '\.\/_hooks\/useWorkspaceGalleryActions';/);
  assert.match(appSource, /useWorkspaceGalleryActions\(\{/);
  assert.doesNotMatch(appSource, /const handleQuadTileAction = useCallback/);
  assert.doesNotMatch(appSource, /const handleGalleryGroupAction = useCallback/);
  assert.doesNotMatch(appSource, /const handleGalleryFeedStateChange = useCallback/);
  assert.doesNotMatch(appSource, /const openGuidedSampleAt = useCallback/);

  assert.match(hookSource, /export function useWorkspaceGalleryActions/);
  assert.match(hookSource, /const handleQuadTileAction = useCallback/);
  assert.match(hookSource, /const handleGalleryGroupAction = useCallback/);
  assert.match(hookSource, /const handleGalleryFeedStateChange = useCallback/);
  assert.match(hookSource, /const openGuidedSampleAt = useCallback/);
  assert.match(hookSource, /buildQuadTileFromRender/);
  assert.match(hookSource, /buildQuadTileFromGroupMember/);
  assert.match(hookSource, /haveSameGroupOrder/);
});
