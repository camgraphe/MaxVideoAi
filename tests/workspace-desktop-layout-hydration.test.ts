import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appClientPath = 'frontend/app/(core)/(workspace)/app/AppClient.tsx';
const desktopLayoutHookPath = 'frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceDesktopLayout.ts';

test('workspace desktop layout detection is owned by a hydration-safe hook', () => {
  assert.equal(existsSync(desktopLayoutHookPath), true);

  const appSource = readFileSync(appClientPath, 'utf8');
  const hookSource = readFileSync(desktopLayoutHookPath, 'utf8');

  assert.match(appSource, /import \{ useWorkspaceDesktopLayout \} from '\.\/_hooks\/useWorkspaceDesktopLayout';/);
  assert.match(appSource, /const isDesktopLayout = useWorkspaceDesktopLayout\(\);/);
  assert.doesNotMatch(appSource, /window\.matchMedia/);
  assert.doesNotMatch(appSource, /DESKTOP_RAIL_MIN_WIDTH/);

  assert.match(hookSource, /useState\(false\)/);
  assert.match(hookSource, /window\.matchMedia\(`\(min-width: \$\{DESKTOP_RAIL_MIN_WIDTH\}px\)`\)/);
  assert.match(hookSource, /handleChange\(mediaQuery\)/);
});
