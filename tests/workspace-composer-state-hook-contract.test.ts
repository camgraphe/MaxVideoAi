import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('workspace composer mode and settings state is owned by a route-local hook', () => {
  const appSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/AppClient.tsx'),
    'utf8'
  );
  const hookPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceComposerState.ts'
  );
  assert.equal(fs.existsSync(hookPath), true);

  const hookSource = fs.readFileSync(hookPath, 'utf8');

  assert.match(appSource, /import \{ useWorkspaceComposerState \} from '\.\/_hooks\/useWorkspaceComposerState';/);
  assert.match(appSource, /useWorkspaceComposerState\(\{/);
  assert.doesNotMatch(appSource, /const multiPromptTotalSec = useMemo/);
  assert.doesNotMatch(appSource, /const implicitMode = useMemo<Mode>/);
  assert.doesNotMatch(appSource, /const audioWorkflowUnsupported =/);
  assert.doesNotMatch(appSource, /const handleEngineChange = useCallback/);
  assert.doesNotMatch(appSource, /const handleComposerModeToggle = useCallback/);
  assert.doesNotMatch(appSource, /const handleDurationChange = useCallback/);
  assert.doesNotMatch(appSource, /const handleResolutionChange = useCallback/);

  assert.match(hookSource, /export function useWorkspaceComposerState/);
  assert.match(hookSource, /const multiPromptTotalSec = useMemo/);
  assert.match(hookSource, /const implicitMode = useMemo<Mode>/);
  assert.match(hookSource, /const audioWorkflowUnsupported =/);
  assert.match(hookSource, /const handleEngineChange = useCallback/);
  assert.match(hookSource, /const handleComposerModeToggle = useCallback/);
  assert.match(hookSource, /const handleDurationChange = useCallback/);
  assert.match(hookSource, /const handleResolutionChange = useCallback/);
  assert.match(hookSource, /buildComposerModeToggles/);
  assert.match(hookSource, /getComposerWorkflowNotice/);
  assert.match(hookSource, /getUnifiedSeedanceMode/);
  assert.match(hookSource, /getUnifiedHappyHorseMode/);
});
