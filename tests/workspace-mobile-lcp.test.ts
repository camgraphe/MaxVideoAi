import assert from 'node:assert/strict';
import test from 'node:test';

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
