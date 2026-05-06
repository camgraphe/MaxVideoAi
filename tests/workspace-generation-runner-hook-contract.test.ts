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
  assert.equal(fs.existsSync(hookPath), true);

  const hookSource = fs.readFileSync(hookPath, 'utf8');

  assert.match(appSource, /import \{ useWorkspaceGenerationRunner \} from '\.\/_hooks\/useWorkspaceGenerationRunner';/);
  assert.match(appSource, /useWorkspaceGenerationRunner\(\{/);
  assert.doesNotMatch(appSource, /const startRender = useCallback/);
  assert.doesNotMatch(appSource, /const presentInsufficientFunds =/);
  assert.doesNotMatch(appSource, /const runIteration = async/);

  assert.match(hookSource, /export function useWorkspaceGenerationRunner/);
  assert.match(hookSource, /const startRender = useCallback/);
  assert.match(hookSource, /prepareGenerationInputs/);
  assert.match(hookSource, /prepareLocalGenerationRender/);
  assert.match(hookSource, /projectAcceptedGenerationResult/);
  assert.match(hookSource, /projectGenerationPollStatus/);
  assert.match(hookSource, /runGenerate/);
});
