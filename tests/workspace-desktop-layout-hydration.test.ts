import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appClientPath = 'frontend/app/(core)/(workspace)/app/AppClient.tsx';
const appReadyViewPath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceAppReadyView.tsx';
const appShellPath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceAppShell.tsx';
const bootSurfacePath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceBootSurface.tsx';
const loadStatePath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceAppLoadState.tsx';
const workspaceChromePath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceChrome.tsx';
const galleryRailPath = 'frontend/components/GalleryRail.tsx';
const modelReviewStylesPath = 'frontend/app/(core)/(workspace)/app/_components/workspace-model-review.module.css';
const engineSelectPath = 'frontend/src/components/ui/EngineSelect.tsx';

test('workspace shell uses CSS-first responsive layout without a hydration-driven mobile-to-desktop swap', () => {
  const appSource = readFileSync(appClientPath, 'utf8');
  const readyViewSource = readFileSync(appReadyViewPath, 'utf8');
  const shellSource = readFileSync(appShellPath, 'utf8');
  const bootSurfaceSource = readFileSync(bootSurfacePath, 'utf8');
  const loadStateSource = readFileSync(loadStatePath, 'utf8');
  const chromeSource = readFileSync(workspaceChromePath, 'utf8');
  const galleryRailSource = readFileSync(galleryRailPath, 'utf8');
  const modelReviewStyles = readFileSync(modelReviewStylesPath, 'utf8');
  const engineSelectSource = readFileSync(engineSelectPath, 'utf8');

  assert.doesNotMatch(appSource, /useWorkspaceDesktopLayout|isDesktopLayout/);
  assert.doesNotMatch(readyViewSource, /isDesktopLayout/);
  assert.doesNotMatch(shellSource, /isDesktopLayout/);
  assert.doesNotMatch(bootSurfaceSource, /isDesktopLayout/);
  assert.doesNotMatch(loadStateSource, /isDesktopLayout/);
  assert.doesNotMatch(appSource, /window\.matchMedia/);

  assert.match(chromeSource, /min-\[768px\]:flex-row/);
  assert.match(chromeSource, /min-\[768px\]:w-\[240px\]/);
  assert.match(chromeSource, /min-\[900px\]:w-\[272px\]/);
  assert.match(chromeSource, /min-\[1088px\]:w-\[320px\]/);
  assert.match(shellSource, /variant="responsive"/);
  assert.match(shellSource, /window\.matchMedia\('\(min-width: 768px\)'\)/);
  assert.equal((shellSource.match(/<GalleryRail\b/g) ?? []).length, 1);
  assert.match(galleryRailSource, /variant === 'responsive'/);
  assert.match(galleryRailSource, /window\.matchMedia\('\(min-width: 768px\)'\)/);
  assert.match(galleryRailSource, /min-\[768px\]:h-\[calc\(125vh-var\(--header-height\)\)\]/);
  assert.match(galleryRailSource, /min-\[768px\]:max-w-\[232px\]/);
  assert.match(galleryRailSource, /min-\[900px\]:max-w-\[264px\]/);
  assert.match(galleryRailSource, /min-\[1088px\]:max-w-\[312px\]/);
  assert.match(modelReviewStyles, /@media \(max-width: 1087px\)[\s\S]*\.commandIcon[\s\S]*display: block/);
  assert.match(engineSelectSource, /min-\[1088px\]:w-\[320px\] min-\[1088px\]:flex-none/);
  assert.doesNotMatch(engineSelectSource, /sm:w-\[320px\] sm:flex-none/);
});
