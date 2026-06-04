import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appClientPath = 'frontend/app/(core)/(workspace)/app/AppClient.tsx';
const appBootstrapHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAppBootstrap.ts';
const appLoadStatePath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceAppLoadState.tsx';
const appReadyViewPath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceAppReadyView.tsx';
const jobRefreshHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceJobRefresh.ts';
const routeFormStateHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRouteFormState.ts';

test('workspace app client delegates bootstrap data and copy orchestration', () => {
  assert.equal(existsSync(appClientPath), true);
  assert.equal(existsSync(appBootstrapHookPath), true);

  const appSource = readFileSync(appClientPath, 'utf8');
  const bootstrapSource = readFileSync(appBootstrapHookPath, 'utf8');
  const appLines = appSource.split('\n').length;

  assert.match(appSource, /import \{ useWorkspaceAppBootstrap \} from '\.\/_hooks\/useWorkspaceAppBootstrap';/);
  assert.match(appSource, /useWorkspaceAppBootstrap\(\)/);
  assert.doesNotMatch(appSource, /useEngines/);
  assert.doesNotMatch(appSource, /useInfiniteJobs/);
  assert.doesNotMatch(appSource, /useRequireAuth/);
  assert.doesNotMatch(appSource, /useResultProvider/);
  assert.doesNotMatch(appSource, /useI18n/);
  assert.doesNotMatch(appSource, /CLIENT_ENV/);
  assert.doesNotMatch(appSource, /DEFAULT_PROCESSING_COPY/);
  assert.doesNotMatch(appSource, /mergeCopy/);
  assert.ok(appLines <= 330, `expected AppClient to stay at or below 330 lines after ready-view split, got ${appLines}`);

  assert.match(bootstrapSource, /export function useWorkspaceAppBootstrap/);
  assert.match(bootstrapSource, /useEngines/);
  assert.match(bootstrapSource, /useInfiniteJobs\(24, \{ type: 'video' \}\)/);
  assert.match(bootstrapSource, /job\.surface !== 'storyboard'/);
  assert.match(bootstrapSource, /useRequireAuth\(\{ redirectIfLoggedOut: false \}\)/);
  assert.match(bootstrapSource, /useResultProvider/);
  assert.match(bootstrapSource, /normalizeUiLocale/);
  assert.match(bootstrapSource, /getLocalizedWorkflowCopy/);
  assert.match(bootstrapSource, /mergeCopy/);
  assert.match(bootstrapSource, /formatTakeLabel/);
});

test('workspace app client delegates ready shell rendering to a route-local view', () => {
  assert.equal(existsSync(appClientPath), true);
  assert.equal(existsSync(appReadyViewPath), true);

  const appSource = readFileSync(appClientPath, 'utf8');
  const readyViewSource = readFileSync(appReadyViewPath, 'utf8');
  const appLines = appSource.split('\n').length;

  assert.match(appSource, /import \{ WorkspaceAppReadyView \} from '\.\/_components\/WorkspaceAppReadyView';/);
  assert.match(appSource, /<WorkspaceAppReadyView/);
  assert.doesNotMatch(appSource, /WorkspaceAppShell/);
  assert.doesNotMatch(appSource, /WorkspaceComposerSurface/);
  assert.doesNotMatch(appSource, /WorkspaceRuntimeModals/);
  assert.ok(appLines <= 330, `expected AppClient to stay at or below 330 lines after ready-view split, got ${appLines}`);

  assert.match(readyViewSource, /export function WorkspaceAppReadyView/);
  assert.match(readyViewSource, /WorkspaceAppShell/);
  assert.match(readyViewSource, /WorkspaceComposerSurface/);
  assert.match(readyViewSource, /WorkspaceRuntimeModals/);
});

test('workspace app client delegates load state and job refresh surfaces', () => {
  assert.equal(existsSync(appClientPath), true);
  assert.equal(existsSync(appLoadStatePath), true);
  assert.equal(existsSync(jobRefreshHookPath), true);

  const appSource = readFileSync(appClientPath, 'utf8');
  const loadStateSource = readFileSync(appLoadStatePath, 'utf8');
  const jobRefreshSource = readFileSync(jobRefreshHookPath, 'utf8');
  const appLines = appSource.split('\n').length;

  assert.match(appSource, /import \{ getWorkspaceAppLoadState \} from '\.\/_components\/WorkspaceAppLoadState';/);
  assert.match(appSource, /import \{ useWorkspaceJobRefresh \} from '\.\/_hooks\/useWorkspaceJobRefresh';/);
  assert.match(appSource, /getWorkspaceAppLoadState\(\{/);
  assert.match(appSource, /useWorkspaceJobRefresh\(\)/);
  assert.doesNotMatch(appSource, /WorkspaceBootSurface/);
  assert.doesNotMatch(appSource, /getJobStatus/);
  assert.doesNotMatch(appSource, /useCallback/);
  assert.ok(appLines <= 330, `expected AppClient to stay at or below 330 lines after load-state split, got ${appLines}`);

  assert.match(loadStateSource, /export function getWorkspaceAppLoadState/);
  assert.match(loadStateSource, /WorkspaceBootSurface/);
  assert.match(loadStateSource, /loadEnginesError/);
  assert.match(loadStateSource, /noEnginesError/);
  assert.match(jobRefreshSource, /export function useWorkspaceJobRefresh/);
  assert.match(jobRefreshSource, /getJobStatus/);
  assert.match(jobRefreshSource, /MaxVideoAI could not complete this render/);
});

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
  assert.ok(appLines <= 330, `expected AppClient to stay at or below 330 lines after route state split, got ${appLines}`);

  assert.match(routeFormStateSource, /export function useWorkspaceRouteFormState/);
  assert.match(routeFormStateSource, /DEFAULT_PROMPT/);
  assert.match(routeFormStateSource, /createMultiPromptScene/);
  assert.match(routeFormStateSource, /createKlingElement/);
  assert.match(routeFormStateSource, /composerRef/);
  assert.match(routeFormStateSource, /focusComposer/);
});
