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
  const multiPromptStatePath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_lib/workspace-multi-prompt-state.ts'
  );
  assert.equal(fs.existsSync(hookPath), true);
  assert.equal(fs.existsSync(engineModeHookPath), true);
  assert.equal(fs.existsSync(multiPromptStatePath), true);

  const hookSource = fs.readFileSync(hookPath, 'utf8');
  const engineModeHookSource = fs.readFileSync(engineModeHookPath, 'utf8');
  const multiPromptStateSource = fs.readFileSync(multiPromptStatePath, 'utf8');

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
  assert.match(hookSource, /getWorkspaceMultiPromptState/);
  assert.match(hookSource, /const handleDurationChange = useCallback/);
  assert.match(hookSource, /const handleResolutionChange = useCallback/);

  assert.doesNotMatch(hookSource, /const implicitMode = useMemo<Mode>/);
  assert.doesNotMatch(hookSource, /const audioWorkflowUnsupported =/);
  assert.doesNotMatch(hookSource, /getUnifiedSeedanceMode/);
  assert.doesNotMatch(hookSource, /getUnifiedHappyHorseMode/);

  assert.match(multiPromptStateSource, /export function getWorkspaceMultiPromptState/);
  assert.match(multiPromptStateSource, /KLING_MULTI_PROMPT_SCENE_MAX_CHARS/);

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
