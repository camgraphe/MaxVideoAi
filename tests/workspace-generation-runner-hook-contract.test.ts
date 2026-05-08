import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('workspace generation runner is owned by a route-local hook', () => {
  const appSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(core)/(workspace)/app/AppClient.tsx'),
    'utf8'
  );
  const hookPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceGenerationRunner.ts'
  );
  const iterationRunnerPath = path.join(
    process.cwd(),
    'frontend/app/(core)/(workspace)/app/_hooks/workspace-generation-iteration-runner.ts'
  );
  assert.equal(fs.existsSync(hookPath), true);
  assert.equal(fs.existsSync(iterationRunnerPath), true);

  const hookSource = fs.readFileSync(hookPath, 'utf8');
  const iterationRunnerSource = fs.readFileSync(iterationRunnerPath, 'utf8');

  assert.match(appSource, /import \{ useWorkspaceGenerationRunner \} from '\.\/_hooks\/useWorkspaceGenerationRunner';/);
  assert.match(appSource, /useWorkspaceGenerationRunner\(\{/);
  assert.doesNotMatch(appSource, /const startRender = useCallback/);
  assert.doesNotMatch(appSource, /const presentInsufficientFunds =/);
  assert.doesNotMatch(appSource, /const runIteration = async/);

  assert.match(hookSource, /export function useWorkspaceGenerationRunner/);
  assert.match(hookSource, /const startRender = useCallback/);
  assert.match(hookSource, /prepareGenerationInputs/);
  assert.match(hookSource, /runWorkspaceGenerationIteration/);
  assert.doesNotMatch(hookSource, /prepareLocalGenerationRender/);
  assert.doesNotMatch(hookSource, /projectAcceptedGenerationResult/);
  assert.doesNotMatch(hookSource, /projectGenerationPollStatus/);
  assert.doesNotMatch(hookSource, /runGenerate/);
  assert.doesNotMatch(hookSource, /getJobStatus/);
  assert.doesNotMatch(hookSource, /window\.setInterval/);

  assert.match(iterationRunnerSource, /export async function runWorkspaceGenerationIteration/);
  assert.match(iterationRunnerSource, /prepareLocalGenerationRender/);
  assert.match(iterationRunnerSource, /projectAcceptedGenerationResult/);
  assert.match(iterationRunnerSource, /projectGenerationPollStatus/);
  assert.match(iterationRunnerSource, /runGenerate/);
  assert.match(iterationRunnerSource, /getJobStatus/);
  assert.match(iterationRunnerSource, /window\.setInterval/);

  const hookLineCount = hookSource.split('\n').length;
  assert.ok(hookLineCount <= 420, `useWorkspaceGenerationRunner should stay below 420 lines, got ${hookLineCount}`);
});
