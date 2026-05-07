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
  const engineModeHookPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts'
  );
  assert.equal(fs.existsSync(hookPath), true);
  assert.equal(fs.existsSync(engineModeHookPath), true);

  const hookSource = fs.readFileSync(hookPath, 'utf8');
  const engineModeHookSource = fs.readFileSync(engineModeHookPath, 'utf8');

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
  assert.match(hookSource, /useWorkspaceEngineModeState/);
  assert.match(hookSource, /const multiPromptTotalSec = useMemo/);
  assert.match(hookSource, /const handleDurationChange = useCallback/);
  assert.match(hookSource, /const handleResolutionChange = useCallback/);

  assert.doesNotMatch(hookSource, /const implicitMode = useMemo<Mode>/);
  assert.doesNotMatch(hookSource, /const audioWorkflowUnsupported =/);
  assert.doesNotMatch(hookSource, /getUnifiedSeedanceMode/);
  assert.doesNotMatch(hookSource, /getUnifiedHappyHorseMode/);

  assert.match(engineModeHookSource, /export function useWorkspaceEngineModeState/);
  assert.match(engineModeHookSource, /const implicitMode = useMemo<Mode>/);
  assert.match(engineModeHookSource, /const audioWorkflowUnsupported =/);
  assert.match(engineModeHookSource, /const handleEngineChange = useCallback/);
  assert.match(engineModeHookSource, /const handleComposerModeToggle = useCallback/);
  assert.match(engineModeHookSource, /buildComposerModeToggles/);
  assert.match(engineModeHookSource, /getComposerWorkflowNotice/);
  assert.match(engineModeHookSource, /getUnifiedSeedanceMode/);
  assert.match(engineModeHookSource, /getUnifiedHappyHorseMode/);
});
