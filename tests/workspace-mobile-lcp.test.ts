import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { shouldShowWorkspaceBootSurface } from '../frontend/app/(core)/(workspace)/app/_components/WorkspaceAppLoadState';

test('workspace keeps the preview boot surface visible while auth is resolving', () => {
  assert.equal(
    shouldShowWorkspaceBootSurface({
      authLoading: true,
      engineCount: 0,
      isLoading: false,
    }),
    true,
  );
});

test('workspace does not hide a confirmed empty engine response behind the boot surface', () => {
  assert.equal(
    shouldShowWorkspaceBootSurface({
      authLoading: false,
      engineCount: 0,
      isLoading: false,
    }),
    false,
  );
});

test('the video boot reserves the navigation row and keeps its visible reader through editor handoff', () => {
  const route = 'frontend/app/(core)/(workspace)/app/_components/';
  const boot = readFileSync(route + 'WorkspaceBootSurface.tsx', 'utf8');
  const ready = readFileSync(route + 'WorkspacePreviewDock.tsx', 'utf8');
  for (const source of [boot, ready]) {
    assert.match(source, /import \{ CompositePreviewDock/, 'the primary reader must not mount a second lazy fallback');
  }
  assert.match(boot, /<WorkspaceCreationHeading action=/, 'reserve the mobile Activity and Recents row');
  assert.match(boot, /engineSettings=\{PROMPT_ASSISTANCE_PREVIEW \? undefined/, 'the model picker moves into the composer in this layout');
});
