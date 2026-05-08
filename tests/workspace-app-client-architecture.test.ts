import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appClientPath = 'frontend/app/(core)/(workspace)/app/AppClient.tsx';
const routeFormStateHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRouteFormState.ts';

test('workspace app client delegates route form state to a route-local hook', () => {
  assert.equal(existsSync(appClientPath), true);
  assert.equal(existsSync(routeFormStateHookPath), true);

  const appSource = readFileSync(appClientPath, 'utf8');
  const routeFormStateSource = readFileSync(routeFormStateHookPath, 'utf8');
  const appLines = appSource.split('\n').length;

  assert.match(appSource, /import \{ useWorkspaceRouteFormState \} from '\.\/_hooks\/useWorkspaceRouteFormState';/);
  assert.match(appSource, /useWorkspaceRouteFormState\(\)/);
  assert.doesNotMatch(appSource, /const \[prompt, setPrompt\] = useState/);
  assert.doesNotMatch(appSource, /const \[multiPromptScenes, setMultiPromptScenes\] = useState/);
  assert.doesNotMatch(appSource, /const \[klingElements, setKlingElements\] = useState/);
  assert.doesNotMatch(appSource, /const composerRef = useRef/);
  assert.doesNotMatch(appSource, /const focusComposer = useCallback/);
  assert.ok(appLines <= 745, `expected AppClient to stay at or below 745 lines after route state split, got ${appLines}`);

  assert.match(routeFormStateSource, /export function useWorkspaceRouteFormState/);
  assert.match(routeFormStateSource, /DEFAULT_PROMPT/);
  assert.match(routeFormStateSource, /createMultiPromptScene/);
  assert.match(routeFormStateSource, /createKlingElement/);
  assert.match(routeFormStateSource, /composerRef/);
  assert.match(routeFormStateSource, /focusComposer/);
});
