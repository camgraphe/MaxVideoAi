import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const appClientPath = 'frontend/app/(core)/(workspace)/app/AppClient.tsx';
const composerSurfacePath = 'frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx';

test('workspace composer and settings surface is owned by a route-local component', () => {
  assert.equal(existsSync(composerSurfacePath), true);

  const appSource = readFileSync(appClientPath, 'utf8');
  const surfaceSource = readFileSync(composerSurfacePath, 'utf8');

  assert.match(appSource, /import \{ WorkspaceComposerSurface \} from '\.\/_components\/WorkspaceComposerSurface';/);
  assert.match(appSource, /<WorkspaceComposerSurface/);

  assert.doesNotMatch(appSource, /<Composer\b/);
  assert.doesNotMatch(appSource, /<SettingsControls\b/);
  assert.doesNotMatch(appSource, /<CoreSettingsBar\b/);
  assert.doesNotMatch(appSource, /<KlingElementsBuilder\b/);
  assert.doesNotMatch(appSource, /buildComposerAttachments/);
  assert.doesNotMatch(appSource, /buildComposerPromotedActions/);
  assert.doesNotMatch(appSource, /normalizeExtraInputValue/);
  assert.doesNotMatch(appSource, /getSeedanceFieldBlockKey/);
  assert.doesNotMatch(appSource, /MULTI_PROMPT_MIN_SEC/);
  assert.doesNotMatch(appSource, /getLocalizedModeLabel/);

  assert.match(surfaceSource, /export function WorkspaceComposerSurface/);
  assert.match(surfaceSource, /<Composer\b/);
  assert.match(surfaceSource, /<SettingsControls\b/);
  assert.match(surfaceSource, /<CoreSettingsBar\b/);
  assert.match(surfaceSource, /KlingElementsBuilder/);
  assert.match(surfaceSource, /buildComposerAttachments/);
  assert.match(surfaceSource, /buildComposerPromotedActions/);
  assert.match(surfaceSource, /normalizeExtraInputValue/);
  assert.match(surfaceSource, /getSeedanceFieldBlockKey/);
  assert.match(surfaceSource, /MULTI_PROMPT_MIN_SEC/);
  assert.match(surfaceSource, /getLocalizedModeLabel/);
});
